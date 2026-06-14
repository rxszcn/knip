// Block comment variant should also work
/* knip-ignore-next */
export const ignoredByBlockComment = 1;

// Comment with a reason suffix should also work
// knip-ignore-next: this is a public API shim
export const ignoredWithReason = 2;

// Comment NOT immediately preceding (blank line between) should NOT suppress
// knip-ignore-next

export const NOTIgnoredBlankLine = 3;

// Used export, no ignore needed
export const used = 'used';
