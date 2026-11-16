import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const service = url.searchParams.get('service');
	if (service) {
		throw redirect(307, `/pending-applications?service=${service}`);
	}
	throw redirect(307, '/pending-applications');
};

