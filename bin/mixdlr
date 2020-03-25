#!/usr/bin/env node

let mixdlr = require('../index.js')
let path = require('path')

if (process.argv[2]) {
  mixdlr(process.argv[2], process.argv[3])
} else {
  console.log(`Usage: ${path.basename(process.argv[1])} <url> (output file)`)
}
