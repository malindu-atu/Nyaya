"use client";

import {
  User,
  Mail,
  ShieldCheck,
  Loader2,
  Pencil,
  X,
  Camera,
  Lock,
  EyeOff,
  Eye,
} from "lucide-react";
import Image from "next/image";
import { useProfileEditLogic } from "@/lib/ProfileEditForm";
import { useRouter } from "next/navigation";

export default function ProfileEditForm() {
  const router = useRouter(); // Initialize the router

  const {
    profile,
    loading,
    updating,
    errorMsg,
    uploadingImage,
    isModalOpen,
    setIsModalOpen,
    editingField,
    newValue,
    setNewValue,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    deletePassword,
    setDeletePassword,
    isDeleting,
    deleteStep,
    setDeleteStep,
    showDeletePassword,
    setShowDeletePassword,
    handleSave,
    openEditModal,
    handleAvatarClick,
    uploadAvatar,
    handleDeleteAccount,
    fileInputRef,
  } = useProfileEditLogic();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="animate-spin text-[#c5a059]" size={40} />
        <p className="text-gray-500 font-medium text-sm">
          Loading profile data...
        </p>
      </div>
    );
  }

  return (
    /* Increased max-w to 4xl to accommodate the two-column grid */
    <div className="bg-gray-100 p-8 rounded-3xl shadow-xl w-full max-w-4xl border border-gray-100 mx-auto">
      {/*HIDDEN INPUT FIELD */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={uploadAvatar}
        accept="image/*"
        className="hidden"
      />

      {/* Profile Header: Avatar with Hover Effect */}
      <div className="flex flex-col items-center mb-8">
        <div
          onClick={handleAvatarClick}
          className="relative h-28 w-28 mb-4 group cursor-pointer"
        >
          {/* Main Avatar Image */}
          <Image
            src={profile.avatarUrl}
            alt="User Avatar"
            fill
            className="rounded-full border-4 border-[#1e293b] object-cover bg-[#1e293b] shadow-md transition-all duration-300 group-hover:opacity-60 group-hover:scale-105"
          />

          {/* Camera Icon Overlay or Spinner */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {!uploadingImage ? (
              <div className="bg-slate-800/50 p-2 rounded-full backdrop-blur-sm">
                <Camera size={24} className="text-[#1e293b]" />
              </div>
            ) : (
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            )}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-[#1e293b]">Account Details</h2>
        <p className="text-sm text-gray-400">
          View and edit your current profile information
        </p>
      </div>

      {/* --- GRID SYSTEM: INFO ON LEFT (8 cols), BUTTONS ON RIGHT (4 cols) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Profile Info */}
        <div className="lg:col-span-8 space-y-6">
          {/* First Name  Row */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
              First Name
            </label>
            <div className="flex items-center justify-between gap-3 h-12 p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 font-medium">
              <span className="truncate">{profile.firstName}</span>
              <button
                onClick={() =>
                  openEditModal("firstName", "First Name", profile.firstName)
                }
                className="text-blue-500 hover:text-blue-700 transition-colors shrink-0 ml-2"
              >
                <Pencil size={14} className="text-[#1e293b]" />
              </button>
            </div>
          </div>

          {/* Surname Row */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
              Surname
            </label>
            <div className="flex items-center justify-between gap-3 h-12 p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 font-medium">
              <span className="truncate">{profile.surname}</span>
              <button
                onClick={() =>
                  openEditModal("surname", "Surname", profile.surname)
                }
                className="text-blue-500 hover:text-blue-700 transition-colors shrink-0 ml-2"
              >
                <Pencil size={14} className="text-[#1e293b]" />
              </button>
            </div>
          </div>

          {/* Username Row */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
              Username
            </label>
            <div className="flex items-center justify-between gap-3 h-12 p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 font-medium">
              <span className="truncate">{profile.username}</span>
              <button
                onClick={() =>
                  openEditModal("username", "Username", profile.username)
                }
                className="text-blue-500 hover:text-blue-700 transition-colors shrink-0 ml-2"
              >
                <Pencil size={14} className="text-[#1e293b]" />
              </button>
            </div>
          </div>

          {/* Email Row */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
              Email Address <ShieldCheck size={12} className="text-[#c5a059]" />
            </label>
            <div className="flex items-center gap-3 h-12 p-3 bg-gray-100 rounded-xl border border-gray-200 text-gray-400 italic">
              <Mail size={18} className="shrink-0" />
              <span className="truncate">{profile.email}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Action Buttons */}
        <div className="lg:col-span-4 pt-0 space-y-3 flex flex-col justify-center">
          {/* Reset Password Buttons */}
          <button
            type="button"
            onClick={() => router.push("/dashboard/profile/reset-password")}
            className="w-full flex items-center justify-center gap-2 h-12 bg-[#1e293b] rounded-xl text-white font-semibold hover:bg-[#c5a059] transition-all shadow-lg shadow-blue-100"
          >
            <Lock size={16} />
            Reset Password
          </button>

          {/* Delete Account */}
          <button
            type="button"
            onClick={() => {
              setIsDeleteModalOpen(true);
              setDeleteStep("confirm"); // Start at the confirmation question
            }}
            className="w-full flex items-center justify-center gap-2 h-12 bg-[#1e293b] rounded-xl text-white font-semibold hover:bg-[#c5a059] transition-all shadow-lg shadow-blue-100"
          >
            <X size={16} />
            Delete Account
          </button>

          {/* Bottom Row: Back to Profile */}
          <button
            type="button"
            onClick={() => router.push("/dashboard/profile-display")}
            className="w-full flex items-center justify-center gap-2 h-12 bg-[#1e293b] rounded-xl text-white font-semibold hover:bg-[#c5a059] transition-all shadow-lg shadow-gray-200"
          >
            Go Back to Profile
          </button>
        </div>
      </div>

      {/*EDIT MODAL OVERLAY*/}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-center mb-4">
              <Image
                src="/Nyaya_logo_temp.png"
                alt="NYAYA Logo"
                width={80}
                height={80}
                className="rounded-full shadow-sm"
              />
            </div>

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Edit {editingField.label}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* ERROR MESSAGE DISPLAY */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-medium rounded">
                {errorMsg}
              </div>
            )}

            <p className="text-sm text-gray-500 mb-2">
              Current Value:{" "}
              <span className="font-medium text-gray-700">
                {profile[editingField.key as keyof typeof profile]}
              </span>
            </p>

            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={`Enter new ${editingField.label.toLowerCase()}`}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-black mb-6"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-[#d4b06a] border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-[#c5a059] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updating}
                className="flex-1 py-2.5 bg-[#1e293b] rounded-lg text-white font-medium hover:bg-[#0f172a] transition disabled:bg-blue-300"
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT SECURITY MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-red-100 animate-in fade-in zoom-in duration-200">
            {/* STEP 1: ARE YOU SURE? */}
            {deleteStep === "confirm" && (
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-[#c5a059] text-[#0f172a] rounded-full flex items-center justify-center mb-4">
                  <X size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Are you absolutely sure?
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  This will permanently delete your profile, quiz history, and
                  stats. You cannot undo this.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setDeleteStep("initial");
                    }}
                    className="flex-1 py-3 bg-[#d4b06a] rounded-xl font-semibold text-gray-600 hover:bg-[#c5a059] transition"
                  >
                    No, Keep it
                  </button>
                  <button
                    onClick={() => setDeleteStep("password")}
                    className="flex-1 py-3 bg-[#1e293b] rounded-xl font-semibold text-white hover:bg-[#0f172a] transition"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PASSWORD VERIFICATION */}
            {deleteStep === "password" && (
              <>
                <div className="flex justify-center mb-4">
                  <Image
                    src="/Nyaya_logo_temp.png"
                    alt="NYAYA Logo"
                    width={80}
                    height={80}
                    className="rounded-full shadow-sm"
                  />
                </div>

                <div className="flex items-center gap-3 text-[#c5a059]">
                  <ShieldCheck size={24} />
                  <h3 className="text-lg font-bold">Verify Identity</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  Please enter your password to finalize the deletion.
                </p>
                {errorMsg && (
                  <div className="mb-4 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                    {errorMsg}
                  </div>
                )}

                {/* PASSWORD INPUT WITH TOGGLE */}
                <div className="relative mb-6">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full p-3 pr-12 border border-[#c5a059] rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-black transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-[#c5a059] transition-colors"
                  >
                    {showDeletePassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteStep("confirm")}
                    className="flex-1 py-2.5 bg-[#c5a059] rounded-lg text-gray-600 font-medium hover:bg-[#d4b06a] transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 bg-[#1e293b] rounded-lg text-white font-medium hover:bg-[#0f172a] transition disabled:bg-red-300"
                  >
                    {isDeleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}