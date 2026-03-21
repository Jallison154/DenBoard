'use client';

import { createContext, useContext } from "react";

export type DisplayModeValue = {
  /** True when embedded (?embed=1), in an iframe, or on /display/* routes */
  kiosk: boolean;
  /** True when likely in iframe or explicit embed query */
  isEmbed: boolean;
  /** True when URL path starts with /display (cast-optimized duplicate routes) */
  isDisplayRoute: boolean;
};

const defaultValue: DisplayModeValue = {
  kiosk: false,
  isEmbed: false,
  isDisplayRoute: false
};

const DisplayModeContext = createContext<DisplayModeValue>(defaultValue);

export function DisplayModeProvider({
  value,
  children
}: {
  value: DisplayModeValue;
  children: React.ReactNode;
}) {
  return <DisplayModeContext.Provider value={value}>{children}</DisplayModeContext.Provider>;
}

export function useDisplayMode(): DisplayModeValue {
  return useContext(DisplayModeContext);
}
