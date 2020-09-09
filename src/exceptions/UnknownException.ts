/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */

export class UnknownException extends Error {
	raw: Error;
	constructor(err: Error, errorCode: string) {
		super(
			`An unknown error happened.
Please open an issue at https://github.com/timbouc/cart/issues

Error code: ${errorCode}
Original stack:
${err.stack}`);
		this.raw = err;
	}
}
