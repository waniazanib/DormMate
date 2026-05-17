import { io } from "socket.io-client";

// The preview environment serves the backend and frontend on the same port,
// but the backend handles API calls. We can connect to the same origin.
export const socket = io(window.location.origin, {
   autoConnect: false // We will connect when needed
});
