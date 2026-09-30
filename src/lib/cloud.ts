import type { Variable, Row } from "../types";

export interface Me {
  authenticated: boolean;
  authEnabled: boolean;
  email?: string;
  name?: string;
}

export interface CloudProject {
  id: string;
  name: string;
  savedAt: number;
  variables: number;
  rows: number;
}

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function getMe(): Promise<Me> {
  try {
    return await api("/me");
  } catch {
    return { authenticated: false, authEnabled: false };
  }
}

export function login() {
  window.location.href = "/api/auth/login";
}

export async function logout() {
  await api("/auth/logout", { method: "POST" });
}

export async function listProjects(): Promise<CloudProject[]> {
  const data = await api("/projects");
  return data.projects ?? [];
}

export async function saveProject(name: string, variables: Variable[], rows: Row[], fileName: string, id?: string) {
  return api("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, data: { variables, rows, fileName } }),
  });
}

export async function loadProject(id: string): Promise<{ name: string; data: { variables: Variable[]; rows: Row[]; fileName: string } }> {
  return api(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  return api(`/projects/${id}`, { method: "DELETE" });
}
