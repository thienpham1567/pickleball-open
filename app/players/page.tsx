"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import ConfirmModal from "@/components/ConfirmModal";
import type { Player } from "@/lib/players";
import {
  fetchPlayers,
  addPlayer,
  updatePlayer,
  deletePlayer,
  uploadPlayerImage,
} from "@/lib/supabase-data";

/* ======== PAGE ======== */

export default function PlayersPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <main className="pt-20 min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-4xl animate-pulse">👥</div>
              <p style={{ color: "var(--text-muted)" }}>Đang tải...</p>
            </div>
          </main>
        </>
      }
    >
      <PlayersContent />
    </Suspense>
  );
}

/* ======== TYPES ======== */

interface PlayerFormData {
  name: string;
  displayName: string;
  gender: "male" | "female";
  imageFile: File | null;
  imagePreview: string;
}

const EMPTY_FORM: PlayerFormData = {
  name: "",
  displayName: "",
  gender: "male",
  imageFile: null,
  imagePreview: "",
};

/* ======== CONTENT ======== */

function PlayersContent() {
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get("admin") === "true";

  const [males, setMales] = useState<Player[]>([]);
  const [females, setFemales] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeGender, setActiveGender] = useState<"male" | "female">("male");
  const [form, setForm] = useState<PlayerFormData>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load players
  const loadPlayers = useCallback(async () => {
    try {
      const { males: m, females: f } = await fetchPlayers();
      setMales(m);
      setFemales(f);
    } catch (err) {
      console.error("Failed to load players:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  // Open add modal
  const handleAdd = () => {
    setForm({ ...EMPTY_FORM, gender: activeGender });
    setEditPlayer(null);
    setShowAddModal(true);
  };

  // Open edit modal
  const handleEdit = (player: Player) => {
    setForm({
      name: player.name,
      displayName: player.displayName,
      gender: player.gender,
      imageFile: null,
      imagePreview: player.image,
    });
    setEditPlayer(player);
    setShowAddModal(true);
  };

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, imageFile: file, imagePreview: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Save (add or update)
  const handleSave = async () => {
    if (!form.name.trim() || !form.displayName.trim()) return;
    setSaving(true);

    try {
      if (editPlayer) {
        // Update existing player
        let imageUrl: string | undefined;
        if (form.imageFile) {
          imageUrl = await uploadPlayerImage(form.imageFile, editPlayer.id);
        }
        await updatePlayer(editPlayer.id, {
          name: form.name,
          displayName: form.displayName,
          imageUrl,
        });
      } else {
        // Add new player
        let imageUrl = "/hinhmn/player-placeholder.svg";
        if (form.imageFile) {
          // Create a temp ID for the upload
          const tempId = form.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
          const prefix = form.gender === "male" ? "a" : "c";
          imageUrl = await uploadPlayerImage(form.imageFile, `${prefix}-${tempId}`);
        }
        await addPlayer({
          name: form.name,
          displayName: form.displayName,
          gender: form.gender,
          imageUrl,
        });
      }

      await loadPlayers();
      setShowAddModal(false);
      setEditPlayer(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Lỗi khi lưu! Kiểm tra console.");
    }
    setSaving(false);
  };

  // Delete player
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deletePlayer(deleteTarget.id);
      await loadPlayers();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Lỗi khi xóa! Kiểm tra console.");
    }
    setDeleteTarget(null);
    setSaving(false);
  };

  const currentPlayers = activeGender === "male" ? males : females;
  const genderLabel = activeGender === "male" ? "Nam" : "Nữ";
  const genderIcon = activeGender === "male" ? "♂" : "♀";

  return (
    <>
      <Navbar />
      <main className="pt-16 sm:pt-20 pb-20 min-h-screen" style={{ background: "var(--bg-primary)" }}>

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-6 sm:pt-10 pb-4 sm:pb-6 px-4"
        >
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="h-px w-12 sm:w-20" style={{ background: "linear-gradient(to right, transparent, var(--gold))" }} />
            <span className="text-sm sm:text-lg font-bold tracking-[0.35em] uppercase" style={{ color: "var(--gold)", fontFamily: "var(--font-display)" }}>
              QUẢN LÝ
            </span>
            <div className="h-px w-12 sm:w-20" style={{ background: "linear-gradient(to left, transparent, var(--gold))" }} />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
            <span style={{ background: "linear-gradient(135deg, #3b82f6, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              DANH SÁCH VẬN ĐỘNG VIÊN
            </span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {males.length} nam • {females.length} nữ
            {!isAdmin && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "var(--gold)" }}>
                Chế độ xem
              </span>
            )}
          </p>
        </motion.section>

        {/* Gender Tabs */}
        <div className="flex justify-center px-4 mb-6">
          <div className="relative inline-flex rounded-xl p-1" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setActiveGender(g)}
                className="relative z-10 flex items-center gap-1.5 px-5 sm:px-8 py-2.5 rounded-lg text-sm font-bold transition-colors duration-200"
                style={{ color: activeGender === g ? (g === "male" ? "var(--male)" : "var(--female)") : "var(--text-muted)" }}
              >
                <span>{g === "male" ? "♂" : "♀"}</span>
                <span>{g === "male" ? "Nam" : "Nữ"}</span>
                <span className="text-xs font-semibold ml-1 px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)" }}>
                  {g === "male" ? males.length : females.length}
                </span>
                {activeGender === g && (
                  <motion.div
                    layoutId="genderTab"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Player Grid */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="text-center py-16">
              <div className="text-4xl animate-pulse mb-4">⏳</div>
              <p style={{ color: "var(--text-muted)" }}>Đang tải danh sách...</p>
            </div>
          ) : (
            <>
              {/* Add Button (admin only) */}
              {isAdmin && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end mb-4">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${activeGender === "male" ? "#3b82f6, #1d4ed8" : "#ec4899, #be185d"})` }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4" /></svg>
                    Thêm {genderLabel}
                  </motion.button>
                </motion.div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                <AnimatePresence mode="popLayout">
                  {currentPlayers.map((player, i) => (
                    <motion.div
                      key={player.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.04 }}
                      className="group relative rounded-2xl overflow-hidden transition-all"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
                    >
                      {/* Player Image */}
                      <div className="relative aspect-square overflow-hidden">
                        <Image
                          src={player.image}
                          alt={player.displayName}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Gradient overlay */}
                        <div
                          className="absolute inset-0"
                          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }}
                        />
                        {/* Gender badge */}
                        <div
                          className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: player.gender === "male" ? "var(--male)" : "var(--female)" }}
                        >
                          {player.gender === "male" ? "♂" : "♀"}
                        </div>

                        {/* Admin action buttons */}
                        {isAdmin && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(player)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white backdrop-blur-sm transition-colors"
                              style={{ background: "rgba(59,130,246,0.7)" }}
                              title="Sửa"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(player)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white backdrop-blur-sm transition-colors"
                              style={{ background: "rgba(239,68,68,0.7)" }}
                              title="Xóa"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" /></svg>
                            </button>
                          </div>
                        )}

                        {/* Player name */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-white font-bold text-sm sm:text-base leading-tight drop-shadow-lg">
                            {player.displayName}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {currentPlayers.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4 opacity-40">{genderIcon}</div>
                  <p style={{ color: "var(--text-muted)" }}>Chưa có vận động viên {genderLabel.toLowerCase()} nào</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: "var(--modal-backdrop)", backdropFilter: "blur(8px)" }}
            onClick={() => { setShowAddModal(false); setEditPlayer(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {editPlayer ? "Sửa Vận Động Viên" : "Thêm Vận Động Viên Mới"}
                </h3>
                <button
                  onClick={() => { setShowAddModal(false); setEditPlayer(null); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Image Upload */}
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="relative w-28 h-28 rounded-2xl overflow-hidden cursor-pointer group"
                    style={{ background: "var(--bg-hover)", border: "2px dashed var(--border-subtle)" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {form.imagePreview ? (
                      <>
                        <Image src={form.imagePreview} alt="" fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <svg className="w-8 h-8" style={{ color: "var(--text-muted)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Chọn ảnh</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Click để tải ảnh lên (JPG, PNG)
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Tên
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="VD: Minh"
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{
                      background: "var(--bg-hover)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="VD: a Minh"
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{
                      background: "var(--bg-hover)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Gender */}
                {!editPlayer && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Giới tính
                    </label>
                    <div className="flex gap-2">
                      {(["male", "female"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setForm((f) => ({ ...f, gender: g }))}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                          style={{
                            background: form.gender === g
                              ? (g === "male" ? "rgba(59,130,246,0.15)" : "rgba(236,72,153,0.15)")
                              : "var(--bg-hover)",
                            border: form.gender === g
                              ? `2px solid ${g === "male" ? "var(--male)" : "var(--female)"}`
                              : "1px solid var(--border-subtle)",
                            color: form.gender === g
                              ? (g === "male" ? "var(--male)" : "var(--female)")
                              : "var(--text-muted)",
                          }}
                        >
                          <span>{g === "male" ? "♂" : "♀"}</span>
                          {g === "male" ? "Nam" : "Nữ"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={() => { setShowAddModal(false); setEditPlayer(null); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.displayName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{
                    background: saving
                      ? "var(--text-muted)"
                      : `linear-gradient(135deg, ${form.gender === "male" ? "#3b82f6, #1d4ed8" : "#ec4899, #be185d"})`,
                  }}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg>
                      Đang lưu...
                    </span>
                  ) : editPlayer ? "Cập nhật" : "Thêm mới"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Xóa vận động viên?"
        message={`Bạn có chắc muốn xóa "${deleteTarget?.displayName}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Giữ lại"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
