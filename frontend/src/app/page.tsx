"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const profile = localStorage.getItem("founderProfile");
    const keywords = localStorage.getItem("keywords");
    if (!profile) router.replace("/onboarding");
    else if (!keywords) router.replace("/onboarding/keywords");
    else router.replace("/dashboard");
  }, []);

  return null;
}
