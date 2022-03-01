/* eslint-disable @typescript-eslint/no-var-requires */
const Ajv = require('ajv')
const addFormats = require('ajv-formats').default
const { schema } = require('@uniswap/token-lists')
const listData = require('../public/opyn.tokenlist.json')

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)

function main() {
  const valid = validate(listData)
  if (!valid) {
    console.error(ajv.errors)
    throw new Error('Token list is invalid')
  } else {
    console.log('Token list is valid')
  }
}

main()

module.exports = main
