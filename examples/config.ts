/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

export default {
	/*
	 |--------------------------------------------------------------------------
	 | Default local storage
	 |--------------------------------------------------------------------------
	 */
	default: 'local',

	/*
	 |--------------------------------------------------------------------------
	 | Cart Storage
	 |--------------------------------------------------------------------------
	 |
	 */
	storages: {
		local: {
			driver: 'local',
			config: {
				path: process.cwd() + '/cart.file',
				encoding: 'utf8',
			},
		},

		redis: {
			driver: 'redis',
			config: {
				prefix: process.env.REDIS_PREFIX || 'cart',
				host: process.env.REDIS_HOST || '127.0.0.1',
				password: process.env.REDIS_PASSWORD,
				port: process.env.REDIS_PORT || 6380,
			},
		},
	},
};