"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

/**
 * ProfileDisplay Component:
 * This component fetches user data from Supabase and renders a read-only 
 * view of the profile. This serves as the "Display State" before editing.
 */
export function useProfileEditLogic() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false); // State for the "Save" button loading
  const [errorMsg, setErrorMsg] = useState(""); // State to hold error messages
  const fileInputRef = useRef<HTMLInputElement>(null); // 2. Ref for the hidden input
  const [uploadingImage, setUploadingImage] = useState(false); // New state for image upload

  //States for Deleation of account
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"initial" | "confirm" | "password">("initial");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  
  // profile: Local state to hold the specific fields we want to show the user
  const [profile, setProfile] = useState({
    id: "",
    firstName: "",
    surname: "",
    username: "",
    email: "",
    avatarUrl: "/Profile_Pic_Icon.png", // Default image fallback
  });

  // --- MODAL STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<{key: string, label: string}>({ key: "", label: "" });
  const [newValue, setNewValue] = useState("");

  // Clear error message when user starts typing
  useEffect(() => {
    if (errorMsg) setErrorMsg("");
  }, [newValue]);

  /**
   * fetchUserData:
   * 1. Checks if the user is authenticated.
   * 2. Pulls user-specific details from the PostgreSQL 'profiles' table.
   */
    useEffect(() => {
        const fetchUserData = async () => {
        try {
            // 1. Get the current user session
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
            console.log("Auth Error or no user:", authError);
            router.push("/login");
            return;
            }

            // 2. Fetch the specific row from the profiles table
            // We use '*' first to see exactly what columns exist if it fails
            const { data, error: dbError } = await supabase
            .from("profiles")
            .select("*") 
            .eq("id", user.id)
            .single();

            if (dbError) {
            console.error("Database Error:", dbError.message);
            return;
            }

            if (data) {
            console.log("Supabase Data Received:", data); // Check your console for this!
            
            // 3. Map the data. Ensure these column names match your Supabase Table!
            setProfile({
                id: user.id, // Set the ID here
                firstName: data.first_name || "Not Set",
                surname: data.surname || "Not Set",
                username: data.username || "Not Set",
                email: data.email || user.email || "Not Set",
                avatarUrl: data.avatar_url || "/Profile_Pic_Icon.png",
            });
            }
        } catch (err) {
            console.error("Unexpected Error:", err);
        } finally {
            setLoading(false);
        }
        };

        fetchUserData();
    
    }, [router]);

    const handleDeleteAccount = async () => {
    // 1. Ensure the user actually typed something
    if (!deletePassword) {
      alert("Please enter your password to confirm.");
      return;
    }

    setIsDeleting(true);
    setErrorMsg("");

    try {
      // 2. MANUAL CREDENTIAL CHECK
      // We attempt to sign in again with the current user's email and the password they just typed
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: deletePassword,
      });

      // If the password is wrong, Supabase will return an error here
      if (verifyError) {
        throw new Error("Verification failed: Incorrect password.");
      }

      // 3. DELETE FROM DATABASE
      // If the password was correct, we proceed to wipe the user's profile row
      const { error: deleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profile.id);

      if (deleteError) throw deleteError;

      // 4. CLEANUP
      // Log the user out of the session and redirect to signup
      await supabase.auth.signOut();
      alert("Account deleted successfully.");
      router.push("/signup");

    } catch (error: any) {
      // Display the error (e.g., "Invalid login credentials")
      setErrorMsg(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

// IMAGE UPLOAD LOGIC  
  const handleAvatarClick = () => {
    if (!uploadingImage) fileInputRef.current?.click();
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingImage(true);
      setErrorMsg("");

      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Math.random()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`; // Folder named after User ID

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update Database profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // 4. Update UI
      setProfile((prev) => ({ ...prev, avatarUrl: publicUrl }));
      
    } catch (error: any) {
      setErrorMsg("Image upload failed: " + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

    /**
   * Opens the edit modal for a specific field
   */
  const openEditModal = (fieldKey: string, label: string, currentValue: string) => {
    setEditingField({ key: fieldKey, label: label });
    setNewValue(currentValue === "Not Set" ? "" : currentValue);
    setIsModalOpen(true);
  };

const handleSave = async () => {
    const trimmedValue = newValue.trim();
    setErrorMsg(""); // Reset error state

    // 1. Basic Validation
    if (!trimmedValue) {
      alert("Field cannot be empty");
      return;
    }

    // 2. Username Specific Rules
    if (editingField.key === "username") {
      if (trimmedValue.includes("@")) {
        setErrorMsg("Usernames cannot contain the '@' symbol.");
        return;
      }

      setUpdating(true);

      try {
        // Check for Uniqueness
        const { data: { user } } = await supabase.auth.getUser();
        const { data: existingUser, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", trimmedValue) 
          .neq("id", user?.id) // Don't count the current user's own name
          .maybeSingle(); // Better than .single() as it doesn't throw error if 0 found

        if (existingUser) {
          setErrorMsg("This username is already taken. Please choose another.");
          setUpdating(false);
          return;
        }
      } catch (err) {
        console.error("Check Error:", err);
      }
    }

    // 3. Perform the actual Update
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      const columnMap: Record<string, string> = {
        firstName: "first_name",
        surname: "surname",
        username: "username"
      };

      const { error: dbError } = await supabase
        .from("profiles")
        .update({ [columnMap[editingField.key]]: trimmedValue })
        .eq("id", user.id);

      if (dbError) throw dbError;

      // Update local UI and Close
      setProfile((prev) => ({ ...prev, [editingField.key]: trimmedValue }));
      setIsModalOpen(false);
      
    } catch (error: any) {
      setErrorMsg("Error: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  return {
    // Data
    profile,
    loading,
    updating,
    errorMsg,
    uploadingImage,
    
    // Modal States
    isModalOpen,
    setIsModalOpen,
    editingField,
    newValue,
    setNewValue,

    // Delete Modal States
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    deletePassword,
    setDeletePassword,
    isDeleting,
    deleteStep,
    setDeleteStep,
    showDeletePassword,
    setShowDeletePassword,

    // Actions
    handleSave,
    openEditModal,
    handleAvatarClick,
    uploadAvatar,
    handleDeleteAccount,
    fileInputRef // Export the ref so the UI can attach it
  };
}

