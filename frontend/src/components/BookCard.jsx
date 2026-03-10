import StarRating from "./StarRating";

const BookCard = ({ book, onClick, showStatus = false }) => {
  const statusColors = {
    want_to_read: { bg: "#FEF3C7", text: "#92400E", label: "Want to read" },
    reading: { bg: "#DBEAFE", text: "#1E40AF", label: "Reading" },
    read: { bg: "#D1FAE5", text: "#065F46", label: "Read" },
  };

  const status = book.status ? statusColors[book.status] : null;

  return (
    <div className="group cursor-pointer" onClick={() => onClick?.(book)}>
      {/* Cover Image */}
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100 border border-gray-200 transition-all group-hover:shadow-lg group-hover:-translate-y-1">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-4"
            style={{ backgroundColor: "#E8D5B7" }}
          >
            <span
              className="text-sm font-semibold text-center"
              style={{ color: "#5C4E35", fontFamily: "'Playfair Display', serif" }}
            >
              {book.title}
            </span>
          </div>
        )}

        {/* Status badge */}
        {showStatus && status && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: status.bg, color: status.text }}
          >
            {status.label}
          </div>
        )}
      </div>

      {/* Book Info */}
      <h3 className="text-sm font-semibold truncate" style={{ color: "#1C1C1C" }}>
        {book.title}
      </h3>
      <p className="text-xs text-gray-500 mb-1.5">{book.author}</p>
      <StarRating rating={book.rating || 0} size={12} />
    </div>
  );
};

export default BookCard;
