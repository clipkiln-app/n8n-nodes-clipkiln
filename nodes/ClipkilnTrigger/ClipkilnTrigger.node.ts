import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { clipkilnRequest, requireApiAccount } from '../Clipkiln/GenericFunctions';

/** What each "Event" choice subscribes to (Clipkiln webhook event types). */
const EVENTS: Record<string, string[]> = {
	clipsReady: ['clips.ready'],
	clipExported: ['clip.exported'],
	storyDone: ['story.done'],
	failed: ['clips.failed', 'clip.failed', 'story.failed', 'post.failed'],
};

export class ClipkilnTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Clipkiln Trigger',
		name: 'clipkilnTrigger',
		icon: { light: 'file:clipkiln.svg', dark: 'file:clipkiln.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when Clipkiln finishes or fails a video, clip or story',
		defaults: {
			name: 'Clipkiln Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'clipkilnApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				default: 'clipExported',
				options: [
					{
						name: 'Clip Exported',
						value: 'clipExported',
						description: 'A clip has finished rendering and is ready to download or post',
					},
					{
						name: 'Clips Ready',
						value: 'clipsReady',
						description: 'The best moments of a video have been found',
					},
					{
						name: 'Job Failed',
						value: 'failed',
						description: 'A video, clip, story or post could not be finished',
					},
					{
						name: 'Story Video Finished',
						value: 'storyDone',
						description: 'A story video made from a script has finished',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (!data.webhookId) return false;
				const res = (await clipkilnRequest.call(this, 'GET', '/api/webhooks')) as {
					endpoints?: Array<{ id: string; url: string }>;
				};
				const url = this.getNodeWebhookUrl('default');
				const found = (res.endpoints ?? []).some((e) => e.id === data.webhookId && e.url === url);
				if (!found) delete data.webhookId;
				return found;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				await requireApiAccount.call(this);
				const event = this.getNodeParameter('event') as string;
				const res = (await clipkilnRequest.call(this, 'POST', '/api/webhooks', {
					url: this.getNodeWebhookUrl('default'),
					events: EVENTS[event],
				})) as { id?: string };
				if (!res.id) return false;
				this.getWorkflowStaticData('node').webhookId = res.id;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.webhookId) {
					try {
						await clipkilnRequest.call(
							this,
							'DELETE',
							`/api/webhooks/${encodeURIComponent(data.webhookId as string)}`,
						);
					} catch (error) {
						this.logger.warn(
							`Clipkiln: could not remove webhook ${String(data.webhookId)}: ${(error as Error).message}`,
						);
						return false;
					}
					delete data.webhookId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const evt = this.getBodyData() as IDataObject;
		const data = (evt.data ?? {}) as IDataObject;
		return {
			workflowData: [
				this.helpers.returnJsonArray({
					id: evt.id,
					event: evt.type,
					created: typeof evt.created === 'number' ? new Date(evt.created * 1000).toISOString() : null,
					...data,
				}),
			],
		};
	}
}
