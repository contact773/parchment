import { nanoid } from 'nanoid'

/** Short, URL-safe unique id. */
export const uid = (size = 12): string => nanoid(size)
