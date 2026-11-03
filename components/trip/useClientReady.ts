"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const client = () => true;
const server = () => false;

// An SSR button must not accept a click before its component can handle it.
export function useClientReady() { return useSyncExternalStore(subscribe, client, server); }
