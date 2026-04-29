"use server"

import { redirect } from "next/navigation"

export async function logout() {
  redirect("https://dashboard.krawma.com/logout")
}
