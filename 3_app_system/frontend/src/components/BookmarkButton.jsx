import { BookmarkIcon as OutlineBookmark } from "@heroicons/react/24/outline";
import { BookmarkIcon as SolidBookmark } from "@heroicons/react/24/solid";

function BookmarkButton({ bookmarked, onToggle, disabled = false }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`p-1 rounded-full bg-white shadow transition ${
        disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:bg-gray-100 cursor-pointer'
      }`}
      aria-label="Toggle Bookmark"
    >
      {bookmarked ? (
        <SolidBookmark className="h-6 w-6 text-purple-600" />
      ) : (
        <OutlineBookmark className="h-6 w-6 text-gray-400" />
      )}
    </button>
  );
}

export default BookmarkButton;
