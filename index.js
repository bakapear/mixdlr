let rimraf = require('rimraf')
let dp = require('despair')
let hy = require('honesty')
let path = require('path')
let fs = require('fs')

const TEMP_DIR = 'temp'
const DASH_URL_PREFIX = 'https://audio8.mixcloud.com/secure/dash2'
const DASH_URL_INIT = '-a1-x3.mp4'
const DASH_URL_FRAGMENT = '-a1-x3.m4s'

module.exports = async function (input, output) {
  log('Fetching site contents...')
  let json = await getSiteData(input)
  if (json.error) return log(json.error, true)
  json.name = json.name.trim()
  log(`"${json.name}" by ${json.owner.displayName}`, true)
  let urls = formatUrls(json.previewUrl)
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR)
  let files = await downloadFiles(urls)
  log('Combining files...')
  let result = combineFiles(files)
  let dir = save(result, output, json.name)
  log('Deleting temp folder...')
  removeTempDir()
  log(`Done! File saved at '${dir}'`, true)
}

async function getSiteData (url, retries = 0) {
  let res = null
  try {
    res = await dp(url)
  } catch (e) { return { error: e.message } }
  if (res.error) return res.error
  let $ = hy(res.body)
  try {
    let data = JSON.parse($('#relay-data').text())[12]
    if (!data) return { error: 'Site not found!' }
    return data.cloudcastLookup.data.cloudcastLookup
  } catch (e) {
    log(`Fetching site contents... Retries: ` + ++retries)
    if (retries >= 5) return { error: `Couldn't parse JSON from Site!` }
    return getSiteData(url, retries)
  }
}

function formatUrls (url) {
  url = DASH_URL_PREFIX + url.substring(url.indexOf('previews') + 8, url.length - 2) + '4a'
  return {
    init: `${url}/init${DASH_URL_INIT}`,
    fragment: x => `${url}/fragment-${x}${DASH_URL_FRAGMENT}`
  }
}

async function download (url, dir) {
  let { body } = await dp(url, { encoding: 'binary' })
  dir = path.join(dir, path.basename(url))
  log(`Downloading Fragments: ` + dir)
  fs.writeFileSync(dir, body, { encoding: 'binary' })
  return dir
}

async function downloadFiles (urls) {
  let files = [await download(urls.init, TEMP_DIR)]
  let getFragment = async num => {
    let dl = await download(urls.fragment(num), TEMP_DIR).catch(e => null)
    if (dl) {
      files.push(dl)
      await getFragment(++num)
    }
  }
  await getFragment(1)
  log(`1 init file and ${files.length - 1} fragments downloaded into '${TEMP_DIR}'.`, true)
  return files
}

function log (msg, newline) {
  process.stdout.cursorTo(0)
  process.stdout.clearLine()
  process.stdout.write(msg + (newline ? '\n' : ''))
}

function combineFiles (files) {
  let res = ''
  for (let i = 0; i < files.length; i++) {
    res += fs.readFileSync(files[i], { encoding: 'binary' })
  }
  return res
}

function save (data, output, name) {
  name = name.replace(/[/?<>\\:*|"]/g, '') + '.mp4'
  if (output) name = output
  fs.writeFileSync(name, data, { encoding: 'binary' })
  return name
}

process.on('SIGHUP', () => {
  removeTempDir()
  process.exit()
})
process.on('SIGINT', () => {
  removeTempDir()
  process.exit()
})

function removeTempDir () {
  if (fs.existsSync(TEMP_DIR)) rimraf.sync(TEMP_DIR)
}
