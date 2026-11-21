import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { clipkilnRequest, requireApiAccount } from './GenericFunctions';

interface ClipJob {
	id: string;
	status: string;
	source_filename?: string;
	clip_count?: number;
}

interface Moment {
	clip_id: string;
	title?: string;
}

export class Clipkiln implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Clipkiln',
		name: 'clipkiln',
		icon: { light: 'file:clipkiln.svg', dark: 'file:clipkiln.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Turn long videos into captioned short clips and make narrated story videos',
		defaults: {
			name: 'Clipkiln',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'clipkilnApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Video', value: 'video' },
					{ name: 'Story Video', value: 'story' },
				],
				default: 'video',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['video'] } },
				options: [
					{
						name: 'Create Clips',
						value: 'createClips',
						description: 'Find the best moments in a video and turn them into captioned short clips',
						action: 'Create clips from a video',
					},
					{
						name: 'Export Clips',
						value: 'exportClips',
						description: "Render a video's clips so they can be downloaded or posted",
						action: 'Export clips of a video',
					},
					{
						name: 'Get',
						value: 'get',
						description: "Get a video's status and number of clips",
						action: 'Get a video',
					},
					{
						name: 'Get Downloads',
						value: 'getDownloads',
						description: "Get download links for a video's rendered clips",
						action: 'Get download links for a video',
					},
				],
				default: 'createClips',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['story'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Turn a script into a narrated video with captions over moving footage',
						action: 'Create a story video',
					},
				],
				default: 'create',
			},
			// ---- Video: Create Clips ----
			{
				displayName: 'Video URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://www.youtube.com/watch?v=...',
				description:
					'A public link to the video: YouTube, Twitch, Google Drive or Dropbox. Costs 5p per minute of video from your API credit.',
				displayOptions: { show: { resource: ['video'], operation: ['createClips'] } },
			},
			{
				displayName: 'Moment Type',
				name: 'category',
				type: 'options',
				default: 'funny',
				options: [
					{ name: 'Crazy', value: 'crazy' },
					{ name: 'Emotional or Intense', value: 'emotionally_intense' },
					{ name: 'Funny', value: 'funny' },
					{ name: 'Informative', value: 'informative' },
				],
				description: 'What makes a moment worth clipping in this video',
				displayOptions: { show: { resource: ['video'], operation: ['createClips'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['video'], operation: ['createClips'] } },
				options: [
					{
						displayName: 'Gameplay',
						name: 'gaming',
						type: 'boolean',
						default: false,
						description: 'Whether the video is gameplay, so kills, wins and on-screen alerts count for more',
					},
					{
						displayName: 'Topic',
						name: 'topic',
						type: 'string',
						default: '',
						description: 'Only clip moments about this subject',
					},
				],
			},
			// ---- Video: pick a video ----
			{
				displayName: 'Video Name or ID',
				name: 'jobId',
				type: 'options',
				required: true,
				default: '',
				typeOptions: { loadOptionsMethod: 'getRecentVideos' },
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				displayOptions: { show: { resource: ['video'], operation: ['exportClips', 'get', 'getDownloads'] } },
			},
			{
				displayName: 'Clip Names or IDs',
				name: 'clipIds',
				type: 'multiOptions',
				default: [],
				typeOptions: { loadOptionsMethod: 'getVideoClips', loadOptionsDependsOn: ['jobId'] },
				description:
					'Leave empty to export every clip. Clips that are already rendered are not rendered again. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { resource: ['video'], operation: ['exportClips'] } },
			},
			// ---- Story: Create ----
			{
				displayName: 'Script',
				name: 'script',
				type: 'string',
				typeOptions: { rows: 4 },
				required: true,
				default: '',
				description: 'The words to narrate. A non-English voice reads the script in its own language.',
				displayOptions: { show: { resource: ['story'], operation: ['create'] } },
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'options',
				default: 'af_heart',
				options: [
					{ name: 'Alex (Brazilian Portuguese Male)', value: 'pm_alex' },
					{ name: 'Alex (Spanish Male)', value: 'em_alex' },
					{ name: 'Alloy (American Female)', value: 'af_alloy' },
					{ name: 'Alpha (Hindi Female)', value: 'hf_alpha' },
					{ name: 'Aoede (American Female)', value: 'af_aoede' },
					{ name: 'Bella (American Female)', value: 'af_bella' },
					{ name: 'Beta (Hindi Female)', value: 'hf_beta' },
					{ name: 'Dora (Brazilian Portuguese Female)', value: 'pf_dora' },
					{ name: 'Dora (Spanish Female)', value: 'ef_dora' },
					{ name: 'Emma (British Female)', value: 'bf_emma' },
					{ name: 'Fable (British Male)', value: 'bm_fable' },
					{ name: 'Fenrir (American Male)', value: 'am_fenrir' },
					{ name: 'George (British Male)', value: 'bm_george' },
					{ name: 'Heart (American Female)', value: 'af_heart' },
					{ name: 'Isabella (British Female)', value: 'bf_isabella' },
					{ name: 'Kore (American Female)', value: 'af_kore' },
					{ name: 'Michael (American Male)', value: 'am_michael' },
					{ name: 'Nicola (Italian Male)', value: 'im_nicola' },
					{ name: 'Nicole (American Female)', value: 'af_nicole' },
					{ name: 'Nova (American Female)', value: 'af_nova' },
					{ name: 'Omega (Hindi Male)', value: 'hm_omega' },
					{ name: 'Psi (Hindi Male)', value: 'hm_psi' },
					{ name: 'Puck (American Male)', value: 'am_puck' },
					{ name: 'Sara (Italian Female)', value: 'if_sara' },
					{ name: 'Sarah (American Female)', value: 'af_sarah' },
					{ name: 'Siwis (French Female)', value: 'ff_siwis' }
				],
				displayOptions: { show: { resource: ['story'], operation: ['create'] } },
			},
			{
				displayName: 'Background Footage',
				name: 'background',
				type: 'options',
				default: 'ink_in_water',
				options: [
					{ name: 'Drone Flythrough', value: 'drone_flythrough' },
					{ name: 'Gameplay', value: 'gameplay' },
					{ name: 'Ink in Water', value: 'ink_in_water' },
					{ name: 'Lava Lamp', value: 'lava_lamp' },
					{ name: 'Metal Cutting', value: 'metal_cutting' },
					{ name: 'POV Skiing', value: 'pov_skiing' },
					{ name: 'Pressure Washing', value: 'pressure_washing' },
					{ name: 'Slime', value: 'slime' }
				],
				displayOptions: { show: { resource: ['story'], operation: ['create'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async getRecentVideos(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const jobs = (await clipkilnRequest.call(this, 'GET', '/api/v1/clips', undefined, {
					limit: 50,
				})) as ClipJob[];
				return jobs.map((j) => ({
					name: `${j.source_filename ?? j.id} (${j.status}, ${j.clip_count ?? 0} clips)`,
					value: j.id,
				}));
			},
			async getVideoClips(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const jobId = this.getCurrentNodeParameter('jobId') as string;
				if (!jobId) return [];
				const moments = (await clipkilnRequest.call(
					this,
					'GET',
					`/api/v1/clips/${encodeURIComponent(jobId)}/moments`,
				)) as Moment[];
				return moments.map((m) => ({ name: m.title ?? m.clip_id, value: m.clip_id }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		await requireApiAccount.call(this);

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let result: IDataObject | IDataObject[];

				if (resource === 'video' && operation === 'createClips') {
					const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
					result = (await clipkilnRequest.call(this, 'POST', '/api/v1/clips', {
						url: this.getNodeParameter('url', i) as string,
						options: {
							category: this.getNodeParameter('category', i) as string,
							topic: (extra.topic as string) ?? '',
							gaming: extra.gaming === true,
						},
					})) as IDataObject;
				} else if (resource === 'video' && operation === 'exportClips') {
					const jobId = this.getNodeParameter('jobId', i) as string;
					const clipIds = this.getNodeParameter('clipIds', i, []) as string[];
					const clips = (await clipkilnRequest.call(
						this,
						'POST',
						`/api/v1/clips/${encodeURIComponent(jobId)}/export`,
						clipIds.length ? { clip_ids: clipIds } : {},
					)) as IDataObject[];
					result = { job_id: jobId, count: clips.length, clips };
				} else if (resource === 'video' && operation === 'get') {
					const jobId = this.getNodeParameter('jobId', i) as string;
					result = (await clipkilnRequest.call(
						this,
						'GET',
						`/api/v1/clips/${encodeURIComponent(jobId)}`,
					)) as IDataObject;
				} else if (resource === 'video' && operation === 'getDownloads') {
					const jobId = this.getNodeParameter('jobId', i) as string;
					result = (await clipkilnRequest.call(
						this,
						'GET',
						`/api/v1/clips/${encodeURIComponent(jobId)}/downloads`,
					)) as IDataObject[];
				} else {
					const story = (await clipkilnRequest.call(this, 'POST', '/api/v1/stories', {
						script: this.getNodeParameter('script', i) as string,
						voice: this.getNodeParameter('voice', i) as string,
						background: this.getNodeParameter('background', i) as string,
					})) as IDataObject;
					result = (await clipkilnRequest.call(
						this,
						'POST',
						`/api/v1/stories/${encodeURIComponent(story.id as string)}/render`,
					)) as IDataObject;
				}

				const rows = Array.isArray(result) ? result : [result];
				for (const row of rows) out.push({ json: row, pairedItem: i });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				// Clipkiln's own sentence is already the message (GenericFunctions); keep it.
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
					message: (error as Error).message,
				});
			}
		}
		return [out];
	}
}
