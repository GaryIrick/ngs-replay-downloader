# ngs-replay-downloader

This will gather replays from an NGS season.

## Running the downloader

- Make sure Node is installed.
- Clone this repository.
- Run `npm install`.
- Run `node download.js {season}` where `{season}` is the season to download.

If you are only interested in a particular division, you can do this:
- `node download.js {season} {division}` where `{division}` is the division, like `Heroic`, `B`, or `B-West`.

The files will be placed in a folder called `replays`.  Each season will be in a separate folder, and each division in a separate folder under that, like this:

- replays
    - 14
        - heroic
        - nexus
        - b
            - b-east
            - b-west
    - 15
        - heroic
        - nexus
        - b
            - b-east
            - b-west

If the downloader is run again later, only new replays that are not already in the `replays` folder will be downloaded.