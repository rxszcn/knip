export { used } from './module';

// `foo` and `bar` are re-exported from the entry so they count as used; otherwise
// their only consumers would be the dangling re-export bindings in module.ts, which
// would (correctly) make them unused and pollute this directive-focused fixture.
export { foo, bar } from './other';
