"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return (
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="mb-6 text-2xl font-bold">后台登录</h1>

        <input
          type="password"
          placeholder="输入后台密码"
          className="w-full rounded-xl border px-4 py-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="mt-4 w-full rounded-xl bg-pink-500 px-4 py-3 text-white"
          onClick={() => {
            localStorage.setItem("admin_password", password);
            setAuthed(true);
          }}
        >
          进入后台
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">博客后台</h1>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <a href="/admin/posts" className="rounded-2xl border p-6">
           管理文章
        </a>

        <a href="/admin/photos" className="rounded-2xl border p-6">
           管理相册
        </a>
      </div>
    </main>
  );
}
