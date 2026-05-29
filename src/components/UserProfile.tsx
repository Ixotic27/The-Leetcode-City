import React from 'react';
import Image from 'next/image';

interface UserProfileProps {
  shareData: {
    avatar_url: string | null;  // Changed from string | undefined
    login: string;
    rank: number | string | null; // Changed from string | number | undefined
    contributions: number;
  };
  theme: {
    accent: string;
  };
}

const UserProfile: React.FC<UserProfileProps> = ({ shareData, theme }) => {
  return (
    <div className="text-center">
      {/* Avatar */}
      {shareData.avatar_url && (
        <Image
          src={shareData.avatar_url}
          alt={shareData.login}
          width={48}
          height={48}
          className="mx-auto mb-3 border-[2px] border-border"
          style={{ imageRendering: "pixelated" }}
        />
      )}

      <p className="text-xs text-cream normal-case">
        <span style={{ color: theme.accent }}>@{shareData.login}</span> joined the city!
      </p>

      <p className="mt-2 text-[10px] text-muted normal-case">
        City Rank <span style={{ color: theme.accent }}>#{shareData.rank ?? "?"}</span>
        {" · "}
        <span style={{ color: theme.accent }}>{shareData.contributions.toLocaleString()}</span> solved
      </p>
    </div>
  );
};

export default UserProfile;