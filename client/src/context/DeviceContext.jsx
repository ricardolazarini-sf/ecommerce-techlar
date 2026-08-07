import { createContext, useContext, useState } from 'react';
import { getDeviceId } from '../api/client.js';

const DeviceContext = createContext(null);

// Ensures a stable anonymous device id exists as early as possible.
export function DeviceProvider({ children }) {
  const [deviceId] = useState(() => getDeviceId());
  return <DeviceContext.Provider value={{ deviceId }}>{children}</DeviceContext.Provider>;
}

export const useDevice = () => useContext(DeviceContext);
