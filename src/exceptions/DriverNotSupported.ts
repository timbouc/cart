/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */


export class DriverNotSupported extends Error{
    public driver!: string;

	public static driver(name: string): DriverNotSupported {
		const exception = new this(`Driver ${name} is not supported`);

		exception.driver = name;

		return exception;
	}
}
