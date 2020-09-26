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
	public static compute(msg: string|null = null): OperationFailed {
		return new this('Failed to compute for cart' + msg? `: ${msg}`:'');
	}
	public static condition(msg: string|null = null): OperationFailed {
		return new this('Failed to get condition' + msg? `: ${msg}`:'');
	}
	public static getItem(msg: string|null = null): OperationFailed {
		return new this('Failed to get item' + msg? `: ${msg}`:'');
	}
	public static parseString(msg: string|null = null): OperationFailed {
		return new this('Failed to parse string' + msg? `: ${msg}`:'');
	}
}
