import { auth } from "./firebase";

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  if (options.body && !(options.body instanceof FormData)) {
     headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || "API Request Failed");
  }
  
  return data;
};
