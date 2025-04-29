/**
 * Cloudflare Worker combining robust CORS handling with POST JSON processing.
 */

// Define allowed origins. '*' allows any origin. For production, restrict this.
// e.g., ['http://127.0.0.1:5500', 'https://your-frontend.pages.dev']
const allowedOrigins = ['*'];
import OpenAI from 'openai';

// Function to create a CORS-preflight (OPTIONS) response
function handleOptions(request) {
	const requestOrigin = request.headers.get('Origin');
	// Check if the origin is allowed
	if (requestOrigin && (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin))) {
		// Define headers for the preflight response
		const corsHeaders = {
			'Access-Control-Allow-Origin': requestOrigin, // Echo back the requesting origin
			'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', // Specify allowed methods
			'Access-Control-Allow-Headers': 'Content-Type', // Specify allowed headers
			'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day (optional)
		};
		console.log('Handling OPTIONS preflight for allowed origin:', requestOrigin);
		// Return a 204 No Content response with CORS headers
		return new Response(null, { status: 204, headers: corsHeaders });
	} else {
		// If origin is not allowed or not present, handle as a standard OPTIONS request
		// Or return 403 Forbidden if you want to strictly block disallowed origins
		console.log('Handling standard OPTIONS or disallowed origin:', requestOrigin);
		return new Response(null, {
			headers: {
				Allow: 'POST, GET, OPTIONS', // Indicate allowed methods
			},
		});
	}
}

// Function to add CORS headers to responses
function addCorsHeaders(response, origin) {
	const headers = new Headers(response.headers);
	headers.set('Access-Control-Allow-Origin', origin || '*');
	headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Content-Type');
	return new Response(response.body, {
		status: response.status,
		headers: headers,
	});
}

export default {
	async fetch(request, env, ctx) {
		const origin = request.headers.get('Origin');

		// Handle OPTIONS (preflight) requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': origin || '*',
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		// Handle POST requests
		if (request.method === 'POST') {
			try {
        const { messages } = await request.json();
        console.log('Messages:',messages)
				const openai = new OpenAI({
					apiKey: env.OPENAI_API_KEY,
          baseURL: 'https://gateway.ai.cloudflare.com/v1/d6cbd1d73e588a9bab775da3703cb429/trevor-mopoer/openai'
				});
        console.log('OpenAI client initialized')
				const chatCompletion = await openai.chat.completions.create({
					model: 'gpt-3.5-turbo',
					messages,
					temperature: 1.1,
					presence_penalty: 0,
					frequency_penalty: 0,
				});
        console.log('OpenAI response:', chatCompletion);
				const response = chatCompletion.choices[0].message;
				return addCorsHeaders(new Response(JSON.stringify(response), {
					headers: { 'Content-Type': 'application/json' },
				}), origin);
			} catch (e) {
				return addCorsHeaders(new Response(JSON.stringify({ error: e.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}), origin);
			}
		}

		// Handle other methods
		return addCorsHeaders(new Response('Method Not Allowed', { status: 405 }), origin);
	},
};