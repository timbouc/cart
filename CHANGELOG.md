# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.



## 0.1.6

- feat: allow custom fields in cart items
- fix: typo in README

## 0.1.7

- feat: get or put miscellaneous data in cart

## 0.1.8

- feat: allow `shipping` as a condition type
- fix: add(...): condition return type potential return type error
- fix: apply(...): use condition return type and return applied condition(s)
- feat: apply(...): replace already existing condition if exists

## 0.1.9

- fix: update README with more details on `data()` and fix typo
- feat: return all data if no params specified

## 0.1.10

- fix: update README

## 0.2.0

- refactor:  abstract cart/storage integration into *data loader* layer with read/write buffering/throttling. Avoids racing conditions and unnecessary calls
- refactor!: remove `Cart.storages` method from Cart class
- refactor!: remove `Cart.addStorage` method from Cart class
- feat: enable callback hook for custom  *item*/*condition* price calculation for complex pricing
- feat: add dynamic typing to `Cart.data` method
- feat: added detailed options as params to the `Cart.clear` method
- feat: added `copy` method for copy cart instance
- feat: allow passing object as first param in `Cart.data` method

## 0.2.1

- fix: accepting object in `Cart.data` method not to override existing data
- fix: update README with 0.2.0 feature
- fix: do not await dataload throttle flush (avoid infinite wait in initial invocation)

## 0.2.2
- fix: fix async/await error in `Cart.data` method
- fix: typo in config example
- fix: cancel data `loader` pending reads on key (session) switch
