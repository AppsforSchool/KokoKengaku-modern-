const firebaseConfig = {
  apiKey: "AIzaSyAqIiNj0N4WruPSOkWbeo5gxzsNyeMkuLo",
  authDomain: "appsforschool-study.firebaseapp.com",
  projectId: "appsforschool-study",
  storageBucket: "appsforschool-study.firebasestorage.app",
  messagingSenderId: "740735293440",
  appId: "1:740735293440:web:982702b6d53aaa18ec60e5"
};

// Firebase 初期化とサービス取得
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let myUid = "";
let myUserId = "";
let meIsAdmin = false;

let loadingOverlay;
let noActiveOverlay;
let drawerOverlay;
let accountSettingsDrawer;
let drawerCloseButton;
let accountSettingsButton;
let drawerUserId;
let drawerLogoutButton;
let drawerUsername;
let changeUsernameButton;
let newUsernameInput;
let usernameMessage;
document.addEventListener("DOMContentLoaded", () => {
  loadingOverlay = document.getElementById("loading-overlay");
  noActiveOverlay = document.getElementById("no-active-overlay");
  
  drawerOverlay = document.getElementById("drawerOverlay");
  accountSettingsDrawer = document.getElementById("accountSettingsDrawer");
  drawerCloseButton = document.getElementById("drawerCloseButton");
  accountSettingsButton = document.getElementById("setting-button");
  
  drawerUserId = document.getElementById("drawerUserId");
  drawerLogoutButton = document.getElementById("logout-button");
  drawerUsername = document.getElementById("drawerUsername");
  changeUsernameButton = document.getElementById("changeUsernameButton");
  newUsernameInput = document.getElementById("newUsernameInput");
  usernameMessage = document.getElementById("username-message");
  
  accountSettingsButton.addEventListener('click', openDrawer);
  drawerCloseButton.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
  drawerLogoutButton.addEventListener('click', handleLogout);
  
  changeUsernameButton.addEventListener('click', handleChangeUsername);
newUsernameInput.addEventListener('input', updateNameButtonState);
});


function openDrawer() {
    accountSettingsDrawer.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
}
function closeDrawer() {
  accountSettingsDrawer.classList.remove('is-open');
  drawerOverlay.classList.remove('is-open');
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
   try {
    if (user) {
      
      
      myUserId = user.email.split("@")[0];
      drawerUserId.textContent = myUserId;
      
      
      const userSnapshot = await db.collection("users_random").doc(myUserId).get();
      const userData = userSnapshot.data();

      if (userData.isActive) {
        drawerUsername.textContent = userData.name;
        meIsAdmin = userData.isAdmin;
        if (meIsAdmin) drawerUsername.classList.add("admin");
        myUid = userData.uid;
        loadingOverlay.classList.add("hidden");
        
        getAllTalkData();
      } else {
        loadingOverlay.classList.add("hidden");
        noActiveOverlay.classList.remove("hidden");
        // window.location.href = "404.html";
      }

    } else {
      console.log("logout");
      window.location.href = "./index.html";
    }
   }
    catch (error) {
      console.log(error);
      alert(error);
    }
  });
});

const handleLogout = async () => {
  const isConfirmed = confirm("ログアウトしますか？");
  if (isConfirmed) {
    try {
    await auth.signOut(auth);
    console.log("ログアウトしました！");
    alert("ログアウトしました。");
  } catch (error) {
    console.error("ログアウトエラー:", error);
    alert("ログアウトに失敗しました。");
  }
  }
};

function updateNameButtonState() {
  if (changeUsernameButton) { // changeUsernameButtonが存在する場合のみ実行
    // 値があるかチェック
    usernameMessage.textContent = '';
    const hasNewName = newUsernameInput && newUsernameInput.value.trim() !== '';
    // 入力されていればボタンを有効、そうでなければ無効
    changeUsernameButton.disabled = !hasNewName;
  }
}
// --- 名前変更処理 ---
const handleChangeUsername = async () => {
  // ドロワー内の入力要素とメッセージ要素を取得
  const newUsername = newUsernameInput.value.trim();
  usernameMessage.textContent = ''; // メッセージをクリア

  if (changeUsernameButton) {
    changeUsernameButton.disabled = true;
    changeUsernameButton.textContent = '変更中...';
    usernameMessage.textContent = '';
  }
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("ユーザーがログインしていません。");
    // Firestoreの users/{UID} ドキュメントを更新
    await db.collection('users_random').doc(myUserId).set({
    name: newUsername, // フィールド名も前のコードに合わせて 'name' にしています
  }, { merge: true });

    usernameMessage.style.color = 'green';
    usernameMessage.textContent = 'ユーザーネームが変更されました！';
    drawerUsername.textContent = newUsername; // 表示を更新
    newUsernameInput.value = ''; // 入力フィールドをクリア
    changeUsernameButton.disabled = true;

    } catch (error) {
      console.error("ユーザーネーム変更エラー:", error);
      usernameMessage.style.color = 'red';
      usernameMessage.textContent = 'ユーザーネームの変更に失敗しました。' + error.message;
      changeUsernameButton.disabled = false;
    } finally {
      if (changeUsernameButton) {
        changeUsernameButton.textContent = '名前を変更';
      }
    }
};


// リアルタイム更新の監視を解除するための関数を保持する変数
let talkListenerUnsubscribe = null;

function getAllTalkData() {
  const talkButtonArea = document.getElementById("talk-button-area");
  const talkButtonLoading = document.getElementById("talk-button-loading");
  
  if (talkListenerUnsubscribe) {
    talkListenerUnsubscribe();
  }

  try {
    let query = db.collection("KokoKengaku");
    
    if (!meIsAdmin) {
      // 一般ユーザーの場合は、自分がメンバーに含まれるルームのみに絞り込む
      query = query.where("members", "array-contains", myUserId);
    }
    
    talkListenerUnsubscribe = query.onSnapshot(async (talkSnapshot) => {
        
        // ユーザーの最新の lastChecked を取得
        const userSnapshot = await db.collection("users_random").doc(myUserId).get();
        const userData = userSnapshot.data() || {};
        const lastCheckedMap = userData.lastChecked || {};

        // 変化（追加・修正・削除）があった差分だけをループ処理する
        talkSnapshot.docChanges().forEach(async (change) => {
          const talkDoc = change.doc;
          const roomId = talkDoc.id;
          const roomData = talkDoc.data();
          
          // 1. 新しくルームが追加された、または初回読み込みの場合
          if (change.type === "added") {
            // すでに同じIDのボタンが画面にあれば作成しない（重複防止）
            if (document.getElementById(`room-${roomId}`)) return;

            const talkButton = document.createElement("div");
            talkButton.classList.add("talk-button");
            talkButton.id = `room-${roomId}`; // 部屋ごとのIDを付与
            talkButton.dataUpdatedAt = roomData.lastUpdatedAt; // 更新日時を記憶させておく
            talkButton.addEventListener("click", () => {
              window.location.href = `./talk.html?id=${roomId}`;
            });

            const titleArea = document.createElement("p");
            titleArea.classList.add("title");
            titleArea.textContent = roomData.title;
            
            // 未読数を入れる器（pタグ）をID付きで作っておく
            const newMessageArea = document.createElement("p");
            newMessageArea.classList.add("new-message");
            newMessageArea.id = `unread-${roomId}`;
            newMessageArea.textContent = "取得中...";

            talkButton.appendChild(titleArea);
            talkButton.appendChild(newMessageArea);
            talkButtonArea.appendChild(talkButton); // 画面に直接追加

            // この部屋の未読数を計算して書き換える
            updateSingleRoomUnread(roomId, lastCheckedMap[roomId]);
          }
          
          // 2. メッセージが届くなどして、ルームの情報が更新された場合
          if (change.type === "modified") {
            const talkButton = document.getElementById(`room-${roomId}`);
            if (talkButton) {
              // タイトルが変わっていれば更新（必要なければ消してもOKです）
              const titleArea = talkButton.querySelector(".title");
              if (titleArea) titleArea.textContent = roomData.title;

              // ★ ここがポイント：未読数だけをピンポイントで数え直して更新する
              updateSingleRoomUnread(roomId, lastCheckedMap[roomId]);
            }
          }

          // 3. ルーム自体が削除された場合
          if (change.type === "removed") {
            const talkButton = document.getElementById(`room-${roomId}`);
            if (talkButton) talkButton.remove();
          }
        });

        // 初回のローディング非表示処理
        talkButtonLoading.classList.add("hidden");
        talkButtonArea.classList.remove("hidden");
        
      }, (error) => {
        console.error("リアルタイムリスナーエラー:", error);
      });
      
  } catch (error) {
    console.error("データ取得エラー:", error);
    alert(error);
  }
}

// ★ 特定の1部屋だけ未読数を数え直して画面を書き換える関数
async function updateSingleRoomUnread(roomId, lastCheckedTimestamp) {
  const newMessageArea = document.getElementById(`unread-${roomId}`);
  if (!newMessageArea) return;

  const lastCheckedTime = lastCheckedTimestamp ? lastCheckedTimestamp.toDate() : new Date(0);

  try {
    // 対象の部屋のメッセージ数（未読）だけをカウント
    const unreadSnapshot = await db.collection("KokoKengaku")
      .doc(roomId)
      .collection("talk")
      .where("time", ">", lastCheckedTime)
      .get();

    const unreadCount = unreadSnapshot.size;

    // テキストとクラス（見た目）をピンポイントで更新
    newMessageArea.textContent = `新着: ${unreadCount}件`;
    if (unreadCount === 0) {
      newMessageArea.classList.add("no-message");
    } else {
      newMessageArea.classList.remove("no-message");
    }
  } catch (error) {
    console.error(`未読数更新エラー [Room: ${roomId}]:`, error);
  }
}


let shareModalBtn;
let shareModal;
let shareModalClose;
document.addEventListener("DOMContentLoaded", () => {
  shareModalBtn = document.getElementById("share-modal-btn");
  shareModal = document.getElementById("share-modal");
  shareModalClose = document.getElementById("share-modal-close");
  
  shareModalBtn.addEventListener("click", () => {
    shareModal.classList.remove("hidden");
  });
  shareModalClose.addEventListener("click", () => {
    shareModal.classList.add("hidden");
  });
});
