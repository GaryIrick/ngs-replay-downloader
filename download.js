const process = require('process')
const fs = require('fs')
const agent = require('superagent')
const heroprotocol = require('heroprotocol')
const { ngsApiUrl, replayBucket } = require('./config')

const REPLAYS_DIR = 'replays'
const CAMERA_FILE = 'suspicious-cameras.csv'

const getMatches = async (season) => {
  const result = await (
    agent
      .post(`${ngsApiUrl}/schedule/fetch/reported/matches`)
      .send({ season }))

  return result.body.returnObject
}

const checkForBadCamera = (match, replayUrl, replayFilename) => {
  const initData = heroprotocol.get('replay.initdata', replayFilename)
  const details = heroprotocol.get('replay.details', replayFilename)
  const gameEvents = heroprotocol.get('replay.game.events', replayFilename)

  const players = details.m_playerList.map(p => p.m_name)

  let found = false

  for (const gameEvent of gameEvents) {
    if (gameEvent._event === 'NNet.Game.SCameraUpdateEvent') {
      const distance = gameEvent.m_distance

      if (distance > 8704) {
        const userId = gameEvent._userid.m_userId
        const name = initData.m_syncLobbyState.m_userInitialData[userId].m_name

        if (players.findIndex(p => p === name) > -1) {
          const time = (gameEvent._gameloop - 610) / 16
          fs.appendFileSync(CAMERA_FILE, `${replayUrl},${match.season},${match.divisionConcat},${match.home.teamName},${match.away.teamName},${name},${time},${distance}\n`)

          if (!found) {
            console.log('Found suspicious camera distance.')
            found = true
          }
        }
      }
    }
  }
}

const copyReplayIfNeeded = async (season, match, filename) => {
  const division = match.divisionConcat
  const parts = division.split('-')
  const divisionSubdir = parts.length === 2 ? `${parts[0]}/${parts[0]}-${parts[1]}` : parts[0]
  const directory = `${REPLAYS_DIR}/${season}/${divisionSubdir}`
  const fullPath = `${directory}/${filename}`
  const fullUrl = `https://s3.amazonaws.com/${replayBucket}/${filename}`

  if (fs.existsSync(fullPath)) {
    return 0
  }

  fs.mkdirSync(directory, { recursive: true })

  try {
    const download = await agent.get(fullUrl).responseType('blob')
    fs.writeFileSync(fullPath, download.body)
    console.log(`Downloaded ${filename} for ${division}.`)

    checkForBadCamera(match, fullUrl, fullPath)
  } catch (e) {
    console.log(`Unable to download ${filename} for ${division}.`)
    return 0
  }

  return 1
}

const run = async (season, divisionPrefix) => {
  if (!fs.existsSync(CAMERA_FILE)) {
    fs.writeFileSync(CAMERA_FILE, 'URL,Season,Division,Home,Away,Player,Time,Distance\n')
  }

  const matches = await getMatches(season)
  let count = 0

  for (const match of matches) {
    if (!match.divisionConcat) {
      continue
    }

    if (divisionPrefix !== '' && !match.divisionConcat.toLowerCase().startsWith(divisionPrefix.toLowerCase())) {
      continue
    }

    if (match.replays) {
      for (const i in match.replays) {
        if (i === '_id') {
          continue
        }

        const filename = match.replays[i].url

        if (filename) {
          count += await copyReplayIfNeeded(season, match, filename)
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
  } catch (e) {
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
