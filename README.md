# Gutenberg
Allows users to create webhook subscriptions to events that pass through the system. Consists of 2 parts. A rest api and an events processor.

## Development

You'll need Node (tested with 10.16) and aws-cli.  Install dependencies with `npm i`.

Run the unit tests with `npm run test`.  Run the linter with `npm run lint`.  I guess it doesn't really matter if you track mud on the carpet when the house is about to be town down anyways, but still, it feels rude.

Deploy to dev with `./dev.sh deploy`.  There are other commands in that script but you don't really need them.  Deploy to staging by committing to the staging branch and approving the CodePipeline in the staging AWS account.  When the staging deployment completes a PR from staging to master will be opened automatically.  Deploy to production by merging that PR and approving the CodePipeline in the production account.
