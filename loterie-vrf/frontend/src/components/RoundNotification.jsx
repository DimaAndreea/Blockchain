export default function RoundNotification({ isWinner, onClose }) {
  if (!isWinner && isWinner !== false) return null;

  return (
    <div className="notificationOverlay" onClick={onClose}>
      <div className="notificationModal" onClick={(e) => e.stopPropagation()}>
        {isWinner ? (
          <>
            <div className="notificationTitle" style={{ color: "#22ff88" }}>
              Congratulations! 🎉
            </div>
            <div className="notificationMessage">
              You won this round! Your prize is waiting to be withdrawn.
              <br />
              <br />
              Click the "Withdraw prize" button to claim your reward.
            </div>
          </>
        ) : (
          <>
            <div className="notificationTitle" style={{ color: "#e67e22" }}>
              Better luck next time! 🍀
            </div>
            <div className="notificationMessage">
              You didn't win this round, but don't give up! Every ticket is a chance to win.
              <br />
              <br />
              Buy more tickets in the next round and try your luck again!
            </div>
          </>
        )}
        <button className="notificationBtn" onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
}
