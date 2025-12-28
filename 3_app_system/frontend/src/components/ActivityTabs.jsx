import { useState } from "react";
import EduCard from "./EduCard";

function ActivityTabs({ discussions, replies, activities, bookmarkedEdu }) {
  const [tab, setTab] = useState("discussions");

  const renderTab = () => {
    const list = {
      discussions,
      replies,
      activities,
      bookmarkedEdu,
    }[tab];

    if (!list || list.length === 0) return <p className="text-center text-gray-500 py-4">No items found...</p>;

    if (tab === "bookmarkedEdu") {
      return (
        <div className="flex gap-4 sm:gap-6 lg:gap-8 overflow-x-auto">
          {list.map((item) => (
            <div key={item._id} className="flex-shrink-0 w-80">
              <EduCard item={item} />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex gap-4 sm:gap-6 lg:gap-8 overflow-x-auto">
        {list.map((item, idx) => (
          <div key={idx} className="flex-shrink-0 w-80 bg-gradient-to-br from-[#C3C3E5]/10 to-[#A8A8D8]/10 p-4 rounded-lg border border-[#C3C3E5]/30 shadow-sm hover:shadow-md transition-all duration-200">
            <p className="font-medium text-[#A8A8D8]">ID: {item.id}</p>
            <p className="text-gray-700">Topic: {item.topic}</p>
            <p className="text-gray-600 text-sm">Date: {item.date}</p>
            <button className="mt-2 bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white px-3 py-1 rounded hover:from-[#B8B8E0] hover:to-[#9D9DD3] focus:ring-2 focus:ring-[#C3C3E5] focus:ring-offset-2 transition-all duration-200">
              View
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-6 w-full">
      <div className="bg-gradient-to-r from-[#C3C3E5]/5 to-[#A8A8D8]/5 rounded-xl p-2 mb-6">
        <div className="grid grid-cols-4 gap-2">
          <button
            className={`px-3 py-3 text-sm sm:text-base rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
              tab === "discussions" 
                ? "bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white shadow-lg shadow-[#C3C3E5]/30 scale-105" 
                : "bg-white/70 text-[#A8A8D8] hover:bg-gradient-to-r hover:from-[#C3C3E5]/20 hover:to-[#A8A8D8]/20 hover:text-[#A8A8D8] hover:shadow-md"
            }`}
            onClick={() => setTab("discussions")}
          >
            <div className="flex flex-col items-center">
              <span className="text-lg mb-1">💬</span>
              <span className="hidden sm:inline text-xs">Discussions</span>
              <span className="sm:hidden text-xs">Disc</span>
            </div>
          </button>
          <button
            className={`px-3 py-3 text-sm sm:text-base rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
              tab === "replies" 
                ? "bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white shadow-lg shadow-[#C3C3E5]/30 scale-105" 
                : "bg-white/70 text-[#A8A8D8] hover:bg-gradient-to-r hover:from-[#C3C3E5]/20 hover:to-[#A8A8D8]/20 hover:text-[#A8A8D8] hover:shadow-md"
            }`}
            onClick={() => setTab("replies")}
          >
            <div className="flex flex-col items-center">
              <span className="text-lg mb-1">💭</span>
              <span className="text-xs">Replies</span>
            </div>
          </button>
          <button
            className={`px-3 py-3 text-sm sm:text-base rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
              tab === "activities" 
                ? "bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white shadow-lg shadow-[#C3C3E5]/30 scale-105" 
                : "bg-white/70 text-[#A8A8D8] hover:bg-gradient-to-r hover:from-[#C3C3E5]/20 hover:to-[#A8A8D8]/20 hover:text-[#A8A8D8] hover:shadow-md"
            }`}
            onClick={() => setTab("activities")}
          >
            <div className="flex flex-col items-center">
              <span className="text-lg mb-1">⚡</span>
              <span className="hidden sm:inline text-xs">Activities</span>
              <span className="sm:hidden text-xs">Act</span>
            </div>
          </button>
          <button
            className={`px-3 py-3 text-sm sm:text-base rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
              tab === "bookmarkedEdu" 
                ? "bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white shadow-lg shadow-[#C3C3E5]/30 scale-105" 
                : "bg-white/70 text-[#A8A8D8] hover:bg-gradient-to-r hover:from-[#C3C3E5]/20 hover:to-[#A8A8D8]/20 hover:text-[#A8A8D8] hover:shadow-md"
            }`}
            onClick={() => setTab("bookmarkedEdu")}
          >
            <div className="flex flex-col items-center">
              <span className="text-lg mb-1">🔖</span>
              <span className="hidden sm:inline text-xs">Bookmarks</span>
              <span className="sm:hidden text-xs">Book</span>
            </div>
          </button>
        </div>
      </div>

      <div className="mt-4">{renderTab()}</div>
    </div>
  );
}

export default ActivityTabs;
