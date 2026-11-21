import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export const BASE_URL = 'https://clipkiln.com';

type Ctx = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

/** One authenticated call to the Clipkiln API. Clipkiln's errors are {detail: "…"} or
 *  {detail: {message: "…"}}; that sentence is what the user sees. */
export async function clipkilnRequest(
	this: Ctx,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${path}`,
		json: true,
	};
	if (body !== undefined) options.body = body;
	if (qs !== undefined) options.qs = qs;
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'clipkilnApi', options);
	} catch (error) {
		const response = (error as { response?: { body?: { detail?: unknown } } }).response;
		const detail = response?.body?.detail;
		const message =
			typeof detail === 'string'
				? detail
				: (detail as { message?: string } | undefined)?.message;
		throw new NodeApiError(this.getNode(), error as JsonObject, message ? { message } : {});
	}
}

/** Clipkiln on n8n is for API accounts (pay as you go), like the Zapier and Make apps. */
export async function requireApiAccount(this: Ctx): Promise<void> {
	const usage = (await clipkilnRequest.call(this, 'GET', '/api/v1/usage')) as { plan?: string };
	if (usage.plan !== 'api') {
		throw new NodeOperationError(
			this.getNode(),
			'Clipkiln on n8n is for API accounts. Create one at clipkiln.com/developers (pay as you go, £3 an hour of video) and use a key from its Keys page.',
		);
	}
}
