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
	default: "local",

	/*
	   |--------------------------------------------------------------------------
	   | Optional delay for throttling data storage writes (ms)
	   / Defaults to 1000
	   |--------------------------------------------------------------------------
	   */
	write_throttle_wait: 1000,

	/*
	   |--------------------------------------------------------------------------
	   | Optional delay for throttling data storage reads (ms)
	   / Defaults to 1000
	   |--------------------------------------------------------------------------
	   */
	read_throttle_wait: 1000,

	/*
	   |--------------------------------------------------------------------------
	   | Specify (Optional) callback hooks for computing cart item/condition value
	   / E.g. compute complex "graduated" pricing for cart item based on
	   / quantity or some other miscellaneous value such as weight
	   |--------------------------------------------------------------------------
	   */
	hooks: {
	  /**
	   * Must return a number
	   * @param {CartItem} item
	   * @param {CartContent} content
	   * @returns {number}
	   */
	  item: (item, _content) => item.quantity * item.price,

	  /**
	   * Intercept the value used to compute cart for a given condition
	   * Condition with value `10%` with give the values { value: 10, is_percentage: true }
	   * Use case may include complex voucher condition based on target item price or quantity
	   *
	   * Must return a number
	   * @param {string} condition.name
	   * @param {number} condition.value
	   * @param {boolean} condition.is_percentage
	   * @param {CartItem|undefined} condition.item provided if condition.target targets a cart item
	   * @param {CartContent} content
	   * @returns {number}
	   */
	  condition: (condition, _content) => condition.value
	},

	/*
	   |--------------------------------------------------------------------------
	   | Cart Storage
	   |--------------------------------------------------------------------------
	   |
	   */
	storages: {
	  local: {
		driver: "local",
		config: {
		  path: process.cwd() + "/cart.file",
		  encoding: "utf8"
		}
	  },

	  redis: {
		driver: "redis",
		config: {
		  prefix: process.env.REDIS_PREFIX || "cart",
		  host: process.env.REDIS_HOST || "127.0.0.1",
		  password: process.env.REDIS_PASSWORD,
		  port: process.env.REDIS_PORT || 6379
		}
	  }
	}
  };
