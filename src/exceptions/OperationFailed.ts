/**
 * @timbouc/cart
 *
 * @license MIT
 * @copyright Timbouc - Augustus Okoye<augustus@timbouc.com>
 */


export class OperationFailed extends Error {
	public static addToCart(msg: string|null = null): OperationFailed {
		return new this('Failed to add to cart' + msg? `: ${msg}`:'');
	}
	public static cartUpdate(msg: string|null = null): OperationFailed {
		return new this('Failed to update cart' + msg? `: ${msg}`:'');
	}
}
