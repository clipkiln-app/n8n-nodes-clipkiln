import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ClipkilnApi implements ICredentialType {
	name = 'clipkilnApi';

	displayName = 'Clipkiln API';

	icon: Icon = { light: 'file:clipkiln.svg', dark: 'file:clipkiln.dark.svg' };

	documentationUrl = 'https://clipkiln.com/developers';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Needs a Clipkiln API account (pay as you go). Create one at clipkiln.com/developers, then copy a key from the Keys page. It starts with ck_live_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://clipkiln.com',
			url: '/api/v1/usage',
			method: 'GET',
		},
	};
}
