# n8n-nodes-clipkiln

This is an n8n community node for [Clipkiln](https://clipkiln.com). Clipkiln is a video tool that uses AI to turn long videos into captioned short clips and make narrated story videos from scripts.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Example workflows](#example-workflows) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation
Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-clipkiln`.

## Operations
**Clipkiln** node
- **Video → Create Clips**: send a video link (YouTube, Twitch, Google Drive, Dropbox). Clipkiln finds the best moments and makes captioned short clips. Options: moment type (funny, informative, emotional or intense, crazy), gameplay, topic.
- **Video → Export Clips**: render a video's clips (all, or the ones you pick). Already rendered clips are not rendered again.
- **Video → Get**: a video's status and number of clips.
- **Video → Get Downloads**: download links for a video's rendered clips (links last about 12 hours).
- **Story Video → Create**: turn a script into a narrated video with captions over moving background footage, in one of 26 voices.

**Clipkiln Trigger** node (instant, via webhooks): starts a workflow when
- **Clips Ready**: the best moments of a video have been found,
- **Clip Exported**: a clip has finished rendering,
- **Story Video Finished**: a story video is done,
- **Job Failed**: a video, clip, story or post could not be finished (with the reason).

Activating the workflow subscribes a webhook in your Clipkiln account; deactivating it removes it. Your n8n instance must be reachable from the internet for the trigger to receive events.

## Credentials
You need a **Clipkiln API account** (pay as you go: 5p per minute of video, from prepaid credit).
1. Create an API account at [clipkiln.com/developers](https://clipkiln.com/developers) and top up credit.
2. Open **Keys** in your API account and create a key. It starts with `ck_live_`.
3. In n8n, add a **Clipkiln API** credential and paste the key.

Keys from Clipkiln plan accounts (Free, Base, Pro, Max) are not accepted by these nodes.

## Example workflows
- **YouTube upload → clips → Google Drive**: a trigger for your new uploads → *Clipkiln: Create Clips* → (separate workflow) *Clipkiln Trigger: Clip Exported* → *HTTP Request* (download the clip) → *Google Drive: Upload*.
- **Spreadsheet of links**: *Google Sheets* rows → *Clipkiln: Create Clips* for each link → *Clipkiln Trigger: Clips Ready* → *Clipkiln: Get Downloads* → write the links back to the sheet.
- **Scripts to story videos**: *Notion* or *Airtable* new record → *Clipkiln: Create Story Video* → *Clipkiln Trigger: Story Video Finished* → *Slack* message.
- **Alerts**: *Clipkiln Trigger: Job Failed* → *Email* with the reason.

## Compatibility
Built with `@n8n/node-cli` and tested against n8n-workflow 2.x. Requires n8n 1.x or later.

## Resources
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Clipkiln API documentation](https://clipkiln.com/developers)
- Support: support@clipkiln.com
