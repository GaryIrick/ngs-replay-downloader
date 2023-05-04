const process = require('process')
const fs = require('fs')
const agent = require('superagent')
const { ngsApiUrl, replayBucket } = require('./config')

const getMatches = async (season) => {
  const result = await (
    agent
      .post(`${ngsApiUrl}/schedule/fetch/reported/matches`)
      .send({ season }))

  return result.body.returnObject
}

const copyReplayIfNeeded = async (season, division, filename) => {
  const parts = division.split('-')
  const divisionSubdir = parts.length == 2 ? `${parts[0]}/${parts[0]}-${parts[1]}` : parts[0]
  const directory = `replays/${season}/${divisionSubdir}`
  const fullPath = `${directory}/${filename}`
  let fullUrl = `https://s3.amazonaws.com/${replayBucket}/${filename}`

  if (fs.existsSync(fullPath)) {
    return 0
  }

  fs.mkdirSync(directory, { recursive: true })

  try {
    download = await agent.get(fullUrl)
    fs.writeFileSync(fullPath, download.body)
    console.log(`Downloaded ${filename} for ${division}.`)
  } catch (e) {
    console.log(`Unable to download ${filename} for ${division}.`)
    return 0
  }

  return 1
}

const run = async (season, divisionPrefix) => {
  const matches = await getMatches(season)
  let count = 0

  for (const match of matches) {
    if (!match.divisionConcat || divisionPrefix !== '' && !match.divisionConcat.toLowerCase().startsWith(divisionPrefix.toLowerCase())) {
      continue
    }

    if (match.replays) {
      for (const i in match.replays) {
        if (i === '_id') {
          continue
        }

        const filename = match.replays[i].url

        if (filename) {
          count += await copyReplayIfNeeded(season, match.divisionConcat, filename)
        }
      }
    }
  }

  console.log(`${count} replays downloaded.`)
}

let season = 0
let divisionPrefix = ''

if (process.argv.length >= 3 && process.argv.length <= 4) {
  try {
    season = Number(process.argv[2])
  } catch {
  }

  divisionPrefix = process.argv.length === 4 ? process.argv[3] : ''
}

if (season > 0) {
  run(season, divisionPrefix).then(() => console.log('Complete.'))
} else {
  console.log('Usage: node download.js <season> <division>')
  console.log('    <season> - NGS season, like 15')
  console.log('    <division> - division to download, like Heroic, B, or B-West (optional, case-insensitive)')
}
