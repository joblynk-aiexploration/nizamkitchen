import { AvatarWithUpload, CoverPhotoUpload } from "@/components/storage/file-upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireUser } from "@/lib/auth/session";
import { updateUserProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UserProfileSettingsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [session, params] = await Promise.all([requireUser(), searchParams]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Settings" title="Profile" description="Manage your personal profile and S3-backed profile images." />
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <Card>
        <form action={updateUserProfileAction} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Full name" name="fullName" defaultValue={session.user.fullName} required />
            <TextInput label="Headline" name="headline" defaultValue={session.user.headline ?? ""} />
            <TextInput label="Location" name="location" defaultValue={session.user.location ?? ""} />
            <AvatarWithUpload label="Profile photo" name="profilePhotoFileId" module="users" entityType="user" entityId={session.user.id} defaultFileId={session.user.profilePhotoFileId ?? null} />
            <CoverPhotoUpload label="Cover photo" name="coverPhotoFileId" module="users" entityType="user" entityId={session.user.id} defaultFileId={session.user.coverPhotoFileId ?? null} />
          </div>
          <TextArea label="Bio" name="bio" defaultValue={session.user.bio ?? ""} />
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
    </div>
  );
}
