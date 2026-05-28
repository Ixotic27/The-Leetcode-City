import React from 'react';

interface SearchBarProps {
  username: string;
  setUsername: (value: string) => void;
  feedback: { type: string } | null;
  setFeedback: (value: any) => void;
  loading: boolean;
  theme: { accent: string };
  searchUser: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  username,
  setUsername,
  feedback,
  setFeedback,
  loading,
  theme,
  searchUser,
}) => {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        searchUser();
      }}
      className="mt-2 flex items-center gap-2"
    >
      <input
        type="text"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          if (feedback?.type === "error") setFeedback(null);
        }}
        placeholder="search username to compare"
        className="min-w-0 flex-1 border-[2px] border-border bg-bg px-2.5 py-1.5 text-base sm:text-[10px]"
        onFocus={(e) => (e.currentTarget.style.borderColor = theme.accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
        autoFocus
      />
      <button
        type="submit"
        disabled={loading || !username.trim()}
        className="px-4 py-1.5 bg-accent text-white disabled:opacity-50"
      >
        Search
      </button>
    </form>
  );
};

export default SearchBar;