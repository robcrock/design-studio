// Shared primitives for prototypes, system components and module libraries. No shell or discovery dependencies.
/** Combines conditional class names using Studio's shared class utility. */
export { cn } from 'cn';
/** The themed container shared by artifact hosts and system overlay components. */
export { PortalContext } from '../core/runtime/portal.ts';
/** The nearest host's themed overlay container, or null without a provider. */
export { usePortalContainer } from '../core/runtime/portal.ts';
/** The current color mode of the nearest system theme boundary; use it instead of watching `.dark` on <html>. */
export { useColorMode, type ColorMode } from '../core/runtime/color-mode.ts';
