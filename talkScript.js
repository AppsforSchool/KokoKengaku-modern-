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

let myUserId = "";
let myUid = "";
let meIsAdmin = false;

let talkId;

// キャッシュ用オブジェクト
let userCache = {};
let userAdminCache = {};
let userLastCheckedCache = {}; // ★ 最終確認日時用のキャッシュを追加
let currentRoomMembers = [];   // ★ 現在のルームのメンバーIDリストを保持する変数を追加

// onSnapshotのリスナー解除用
let memberSubscribers = [];

let loadingOverlay;
let noActiveOverlay;
let drawerOverlay;
let accountSettingsDrawer;
let drawerCloseButton;
let accountSettingsButton;
let drawerUserId;
let drawerLogoutButton;
let drawerUsername;
let drawerEditProfileButton; // ドロワーの「プロフィールを編集」ボタン

// ★ アバターの頭文字を安全に取り出すヘルパー
function getInitial(name) {
  if (!name) return "?";
  return Array.from(name.trim())[0] || "?";
}

// ★ 頭文字アバターを生成するヘルパー（size: "small" | "large" | 省略で通常サイズ）
function createAvatar(name, size) {
  const avatar = document.createElement("div");
  avatar.classList.add("avatar-circle");
  if (size === "small") avatar.classList.add("small");
  if (size === "large") avatar.classList.add("large");
  avatar.textContent = getInitial(name);
  return avatar;
}

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
  drawerEditProfileButton = document.getElementById("drawer-edit-profile-button");

  accountSettingsButton.addEventListener("click", openDrawer);
  drawerCloseButton.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);
  drawerLogoutButton.addEventListener("click", handleLogout);

  // ドロワー内の「プロフィールを編集」ボタン
  drawerEditProfileButton.addEventListener("click", () => {
    closeDrawer();
    openProfileModal(myUserId, true); // 自分のプロフィールを編集モードONで開く
  });
});

function openDrawer() {
  accountSettingsDrawer.classList.add("is-open");
  drawerOverlay.classList.add("is-open");
}
function closeDrawer() {
  accountSettingsDrawer.classList.remove("is-open");
  drawerOverlay.classList.remove("is-open");
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    try {
      if (user) {
        myUserId = user.email.split("@")[0];
        drawerUserId.textContent = myUserId;

        const userSnapshot = await db
          .collection("users_random")
          .doc(myUserId)
          .get();
        const userData = userSnapshot.data();

        if (userData.isActive) {
          drawerUsername.textContent = userData.name;
          meIsAdmin = userData.isAdmin;
          if (meIsAdmin) drawerUsername.classList.add("admin");
          myUid = userData.uid;

          userCache[myUserId] = userData.name;
          userAdminCache[myUserId] = userData.isAdmin;

          talkId = getParmFromUrl("id");
          // ★ メンバーのリアルタイム監視・キャッシュ化を開始
          await setupMemberSnapshots(talkId);

          getAllTalkData(talkId);
          
          loadingOverlay.classList.add("hidden");
      } else {
        loadingOverlay.classList.add("hidden");
        noActiveOverlay.classList.remove("hidden");
        // window.location.href = "404.html";
      }
        
        
      } else {
        console.log("logout");
        // ログアウト時にリスナーをすべて解除
        memberSubscribers.forEach(unsub => unsub());
        memberSubscribers = [];
        window.location.href = "./index.html";
      }
    } catch (error) {
      console.log(error);
      alert(error);
    }
  });
});

// ★ ルームメンバーの情報を裏側でリアルタイムに監視してキャッシュを更新する関数
async function setupMemberSnapshots(talkId) {
  try {
    const roomSnapshot = await db.collection("KokoKengaku").doc(talkId).get();
    if (!roomSnapshot.exists) return;

    const roomData = roomSnapshot.data();
    const memberUserIds = roomData.members || [];
    currentRoomMembers = memberUserIds; // ★ ルームに所属するメンバーID一覧を保持

    // 既存のリスナーがあれば念のため解除
    memberSubscribers.forEach(unsub => unsub());
    memberSubscribers = [];

    // 各メンバーのドキュメントに onSnapshot を設定
    memberUserIds.forEach((userId) => {
      const unsub = db.collection("users_random").doc(userId).onSnapshot((doc) => {
        if (doc.exists) {
          const userData = doc.data();
          
          // 各種キャッシュを最新状態に更新
          userCache[userId] = userData.name || "名前未設定";
          userAdminCache[userId] = userData.isAdmin || false;
          
          if (!userLastCheckedCache[userId]) {
            userLastCheckedCache[userId] = {};
          }
          
          if (userData.lastChecked && userData.lastChecked[talkId]) {
            const dateObject = userData.lastChecked[talkId].toDate();
            userLastCheckedCache[userId][talkId] = formatDateTime(dateObject);
          } else {
            userLastCheckedCache[userId][talkId] = "";
          }

          // もしメンバーモーダルが現在開いている状態なら、UIを自動で再描画する
          const memberModal = document.getElementById("member-modal");
          if (memberModal && !memberModal.classList.contains("hidden")) {
            getMember(talkId);
          }
        }
      });
      memberSubscribers.push(unsub);
    });
  } catch (error) {
    console.error("メンバーの監視設定に失敗しました:", error);
  }
}

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

async function getAllTalkData(talkId) {
  const talkTitle = document.getElementById("talk-title");
  const talkArea = document.getElementById("talk-area");

  try {
    const roomSnapshot = await db.collection("KokoKengaku").doc(talkId).get();
    const roomData = roomSnapshot.data();
    talkTitle.textContent = roomData.title;

    db.collection("users_random").doc(myUserId).update({
      [`unreadCounts.${talkId}`]: 0
    }).catch(err => console.error("未読リセットエラー:", err));
    

    db.collection("KokoKengaku")
      .doc(talkId)
      .collection("talk")
      .orderBy("time", "asc")
      .onSnapshot(async (messageSnapshot) => {
        const newTalk = document.createElement("div");
        const loadingText = document.createElement("p");
        loadingText.textContent = "loading...";
        talkArea.innerHTML = "";
        talkArea.appendChild(loadingText);
        newTalk.innerHTML = "";

        for (const talkDoc of messageSnapshot.docs) {
          const messageData = talkDoc.data();
          const message = document.createElement("div");
          message.classList.add("message");

          const messageUserId = messageData.userId;
          const isOwnMessage = messageUserId === myUserId;
          message.classList.add(isOwnMessage ? "message-own" : "message-other");

          const messageUser = document.createElement("p");
          let senderName = "不明なユーザー";
          let isAdmin = false;

          if (messageUserId) {
            if (!(messageUserId in userCache) || !(messageUserId in userAdminCache)) {
              const userSnapshot = await db.collection("users_random").doc(messageUserId).get();
            
              if (userSnapshot.exists) {
                const userData = userSnapshot.data();
                userCache[messageUserId] = userData.name || "名前未設定";
                userAdminCache[messageUserId] = userData.isAdmin || false;
              } else {
                userCache[messageUserId] = "不明なユーザー";
                userAdminCache[messageUserId] = false;
              }
            }
            senderName = userCache[messageUserId];
            isAdmin = userAdminCache[messageUserId];
          }

          let displayTime = "時間不明";
          if (messageData.time) {
            const dateObject = messageData.time.toDate();
            displayTime = formatDateTime(dateObject);
          }

          const readByList = messageData.readBy || [];
          if (messageData.userId !== myUserId && !readByList.includes(myUserId)) {
            db.collection("KokoKengaku")
              .doc(talkId)
              .collection("talk")
              .doc(talkDoc.id)
              .update({
                readBy: firebase.firestore.FieldValue.arrayUnion(myUserId)
              })
              .catch(err => console.error("既読更新エラー:", err));
          }
          
          let displayReadCount = readByList.length;
          const readSpan = document.createElement("span");
          readSpan.textContent = `既読:${displayReadCount}人`;
          readSpan.style.textDecoration = 'underline';
          readSpan.style.cursor = 'pointer';
          readSpan.addEventListener("click", () => {
            openReadByModal(readByList);
          });

          const senderNameSpan = document.createElement("span");
          senderNameSpan.textContent = `${senderName} `;
          senderNameSpan.classList.add("clickable-user");
          senderNameSpan.addEventListener("click", () => {
            openProfileModal(messageUserId);
          });
          
          const displayTimeSpan = document.createElement("span");
          displayTimeSpan.textContent = `${displayTime} `;
          messageUser.classList.add("message-user");
          if (isAdmin) {
            senderNameSpan.classList.add("admin");
          }
          const editSpan = document.createElement("span");
          editSpan.textContent = `編集`;
          editSpan.style.textDecoration = 'underline';
          editSpan.style.cursor = 'pointer';
          editSpan.addEventListener("click", () => {
            openEditModal(talkDoc.id, messageData.userId, messageData.message);
          });

          // ★ 自分の発言では吹き出しの上に自分の名前を出さない（相手の発言のみ表示）
          if (!isOwnMessage) {
            messageUser.appendChild(senderNameSpan);
          }
          messageUser.appendChild(displayTimeSpan);
          messageUser.appendChild(readSpan);
          if (meIsAdmin || messageData.userId === myUserId) {
            messageUser.appendChild(document.createTextNode(" "));
            messageUser.appendChild(editSpan);
          }

          const messageText = document.createElement("p");
          messageText.classList.add("message-text");

          // ★ 画像があれば画像を先に、続けてテキスト（キャプション）があれば表示
          if (messageData.imageUrl) {
            const img = document.createElement("img");
            img.src = messageData.imageUrl;
            img.alt = "送信された画像";
            img.classList.add("message-image");
            messageText.appendChild(img);
          }
          const safeContent = sanitizeHtmlToOnlyLinks(messageData.message);
          messageText.appendChild(safeContent);

          // ★ アバター + 本文をまとめた行を組み立て（自分は右寄せ、相手は左寄せ＋アバター表示）
          const bubbleCol = document.createElement("div");
          bubbleCol.classList.add("bubble-col");
          bubbleCol.appendChild(messageUser);
          bubbleCol.appendChild(messageText);

          const messageRow = document.createElement("div");
          messageRow.classList.add("message-row");
          if (!isOwnMessage) {
            const rowAvatar = createAvatar(senderName);
            rowAvatar.classList.add("clickable-user");
            rowAvatar.addEventListener("click", () => {
              openProfileModal(messageUserId);
            });
            messageRow.appendChild(rowAvatar);
          }
          messageRow.appendChild(bubbleCol);

          message.appendChild(messageRow);

          newTalk.appendChild(message);
        }
        talkArea.innerHTML = "";
        talkArea.appendChild(newTalk);
        talkArea.scrollTop = talkArea.scrollHeight;

        updateLastCheckedTime(talkId, myUserId);
      });
    
  } catch (error) {
    console.error("データ取得エラー:", error);
    alert(error);
  }
}

function sanitizeHtmlToOnlyLinks(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const box = document.createDocumentFragment();

  // 再帰的にノードを処理するヘルパー関数
  function processNode(node) {
    // 1. テキストノードの場合：そのままテキストノードを返す
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }

    // 要素ノード（ELEMENT_NODE）の処理
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toUpperCase();
      let resultElement = null;

      // 各タグに応じた要素の生成
      if (tagName === 'A') {
        resultElement = document.createElement('a');
        const rawHref = node.getAttribute('href') || '#';
        resultElement.setAttribute('href', rawHref);
        resultElement.setAttribute('target', '_blank');
        resultElement.setAttribute('rel', 'noopener noreferrer');
        resultElement.classList.add('chat-link');
      } 
      else if (tagName === 'UNDERLINE') {
        resultElement = document.createElement('span');
        resultElement.classList.add('underline');
      } 
      else if (tagName === 'LARGE') {
        resultElement = document.createElement('span');
        resultElement.classList.add('large');
      } 
      else if (tagName === 'MAINCOLOR') {
        resultElement = document.createElement('span');
        resultElement.classList.add('main-color');
      }
      else if (tagName === 'SMALL') {
        resultElement = document.createElement('span');
        resultElement.classList.add('small');
      }
      else if (tagName === 'EMOJI') {
        resultElement = document.createElement('span');
        resultElement.classList.add('emoji');
      }

      if (resultElement) {
        // 許可されたタグの場合：子ノードを再帰的に処理して自身に追加する
        node.childNodes.forEach(child => {
          const processedChild = processNode(child);
          if (processedChild) {
            resultElement.appendChild(processedChild);
          }
        });
        return resultElement;
      } else {
        // 許可されていない未知のタグ（例: <div>, <p> など）の場合：
        // タグ自体は無視し、中身の子ノード（テキストや許可タグ）だけを平坦化して返す
        const fragment = document.createDocumentFragment();
        node.childNodes.forEach(child => {
          const processedChild = processNode(child);
          if (processedChild) {
            fragment.appendChild(processedChild);
          }
        });
        return fragment;
      }
    }

    return null;
  }

  // ルート直下の子ノードを順次処理して documentFragment に追加
  Array.from(doc.body.childNodes).forEach(node => {
    const processed = processNode(node);
    if (processed) {
      box.appendChild(processed);
    }
  });

  return box;
}


function getParmFromUrl(parm) {
  const params = new URLSearchParams(window.location.search);
  return params.get(parm);
}

function formatDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

let messageInput;
let messageAddButton;
document.addEventListener("DOMContentLoaded", () => {
  messageInput = document.getElementById("message-input");
  messageAddButton = document.getElementById("message-add-button");
  
  messageInput.addEventListener("input", () => {
    updateMessageAddButtonState();
  });
  
  messageAddButton.addEventListener("click", async () => {
    const talkId = getParmFromUrl("id");
    await addMessage(talkId);
  });
});

function updateMessageAddButtonState() {
  const hasMessage = messageInput && messageInput.value.trim() !== "";
  messageAddButton.disabled = !hasMessage;
}

async function addMessage(talkId) {
  const message = messageInput.value.trim();
  messageAddButton.disabled = true;
  messageAddButton.textContent = "送信中...";
  const user = auth.currentUser;
  const myUserId = user.email.split("@")[0];
  try {
    await db.collection("KokoKengaku")
      .doc(talkId)
      .collection("talk")
      .add({
        userId: myUserId,
        message: message,     
        readBy: [],
        time: firebase.firestore.FieldValue.serverTimestamp()
      });
    await db.collection("KokoKengaku").doc(talkId).update({
      lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() // これを追加！
    });
  }
  catch (error) {
    console.log(error);
  }
  finally {
    messageAddButton.disabled = true;
    messageAddButton.textContent = "送信";
    messageInput.value = "";
  }
}

// ★ ルームの members リストに入っている人のみを表示するように修正
function getMember(talkId) {
  const memberArea = document.getElementById("member-area");
  memberArea.innerHTML = "";

  // 自分が管理者かどうかを判定
  const isMeAdmin = userAdminCache[myUserId] || false;

  // ★ 全キャッシュのキーではなく、ルームに属するメンバーIDリストでループを回す
  for (const userId of currentRoomMembers) {
    const memberName = userCache[userId] || "不明なユーザー";
    const isAdmin = userAdminCache[userId] || false;
    let lastCheckedTimeStr = "";

    // キャッシュから対象トークルームの最終確認日時を取得
    if (userLastCheckedCache[userId] && userLastCheckedCache[userId][talkId]) {
      lastCheckedTimeStr = userLastCheckedCache[userId][talkId];
    }

    const memberElement = document.createElement("div");
    memberElement.classList.add("member-item");
    if (isAdmin) memberElement.classList.add("admin");

    // アバター + 名前
    const memberLeft = document.createElement("div");
    memberLeft.classList.add("member-left", "clickable-user");
    memberLeft.style.cursor = 'pointer';

    const avatar = createAvatar(memberName, "small");
    memberLeft.appendChild(avatar);

    const nameSpan = document.createElement("span");
    nameSpan.classList.add("member-name");
    nameSpan.textContent = memberName;
    memberLeft.appendChild(nameSpan);

    // タップ（クリック）されたらプロフィールモーダルを開く
    memberLeft.addEventListener("click", () => {
      openProfileModal(userId);
    });

    memberElement.appendChild(memberLeft);

    // 自分が管理者かつデータがある場合のみ、右側に最終確認時間を追加
    if (isMeAdmin) {
      const timeSpan = document.createElement("span");
      timeSpan.classList.add("member-last-checked");
      timeSpan.textContent = lastCheckedTimeStr ? lastCheckedTimeStr : "未確認";
      memberElement.appendChild(timeSpan);
    }

    memberArea.appendChild(memberElement);
  }
}

async function updateLastCheckedTime(talkId, myUserId) {
  try {
    await db.collection("users_random").doc(myUserId).set({
      lastChecked: {
        [talkId]: firebase.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
    console.log(`${talkId} の最終確認時刻を更新しました`);
  } catch (error) {
    console.error("最終確認時刻の更新に失敗:", error);
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

let toHomeButton;
document.addEventListener("DOMContentLoaded", () => {
  toHomeButton = document.getElementById("to-home-button");
  
  toHomeButton.addEventListener("click", () => {
    window.location.href = "./app.html";
  });
});

let memberButton;
let memberModal;
let memberModalClose;
document.addEventListener("DOMContentLoaded", () => {
  memberButton = document.getElementById("member-button");
  memberModal = document.getElementById("member-modal");
  memberModalClose = document.getElementById("member-modal-close");
  
  memberButton.addEventListener("click", () => {
    memberModal.classList.remove("hidden");
    const talkId = getParmFromUrl("id");
    getMember(talkId); // ★ キャッシュから瞬時にUI描画を行うため、完全にノンブロッキングで一瞬で開く
  });
  memberModalClose.addEventListener("click", () => {
    memberModal.classList.add("hidden");
  });
});

let readModal;
let readModalClose;
let readArea;
document.addEventListener("DOMContentLoaded", () => {
  readModal = document.getElementById("read-modal");
  readModalClose = document.getElementById("read-modal-close");
  readArea = document.getElementById("read-area");
  
  readModalClose.addEventListener("click", () => {
    readModal.classList.add("hidden");
  });
});

// ★ 既読モーダルも基本的には既存のユーザーデータキャッシュを最優先に利用するように最適化
async function openReadByModal(readByList) {
  readArea.innerHTML = "読み込み中...";
  readModal.classList.remove("hidden");

  const fragment = document.createDocumentFragment();

  for (const userId of readByList) {
    let name = userCache[userId];
    let isAdmin = userAdminCache[userId];
    
    // 万が一キャッシュに載っていないイレギュラーなユーザーIDが含まれていた場合のみ個別get
    if (!name) {
      try {
        const userSnapshot = await db.collection("users_random").doc(userId).get();
      
        if (userSnapshot.exists) {
          const userData = userSnapshot.data();
          userCache[userId] = userData.name || "名前未設定";
          userAdminCache[userId] = userData.isAdmin || false;
        } else {
          userCache[userId] = "不明なユーザー";
          userAdminCache[userId] = false;
        }
        name = userCache[userId];
        isAdmin = userAdminCache[userId];
      } catch (e) {
        console.error(e);
        name = "不明なユーザー";
      }
    }

    const p = document.createElement("p");
    p.classList.add("clickable-user");
    p.style.cursor = 'pointer';
    p.appendChild(createAvatar(name, "small"));
    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    if (isAdmin) nameSpan.classList.add("admin");
    p.appendChild(nameSpan);

    p.addEventListener("click", () => {
      openProfileModal(userId);
    });

    fragment.appendChild(p);
  }

  readArea.innerHTML = "";
  readArea.appendChild(fragment);
}


let messageId;
let editModal;
let editModalClose;
let newUserIdInput, newMessageInput, newMessageChangeButton, messageDeleteButton;
document.addEventListener("DOMContentLoaded", () => {
  editModal = document.getElementById("edit-modal");
  editModalClose = document.getElementById("edit-modal-close");
  newUserIdInput = document.getElementById("new-userId-input");
  newMessageInput = document.getElementById("new-message-input");
  newMessageChangeButton = document.getElementById("new-message-change-button");
  messageDeleteButton = document.getElementById("message-delete-button");
  
  editModalClose.addEventListener("click", () => {
    editModal.classList.add("hidden");
  });

  newMessageChangeButton.addEventListener("click", async () => {
    await newMessageChange(messageId, newUserIdInput.value, newMessageInput.value);
  });

  messageDeleteButton.addEventListener("click", async () => {
    if (window.confirm('本当に削除しますか？')) {
      await messageDelete(messageId);
    }
  });
});

function openEditModal(thisMessageId, messageUserId, messageText) {
  messageId = thisMessageId;
  newUserIdInput.value = messageUserId;
  newMessageInput.value = messageText;

  if (!meIsAdmin) {
    newUserIdInput.disabled = true;
    messageDeleteButton.disabled = true;
  }
  
  editModal.classList.remove("hidden");
  
}

async function newMessageChange(messageId, newUserId, newMessage) {
  try {
    const docRef = db.collection("KokoKengaku")
      .doc(talkId)
      .collection("talk")
      .doc(messageId);
    await docRef.update({
      userId: newUserId,
      message: newMessage
    });
    alert("変更しました。");
  }
  catch (error) {
    alert(error);
    console.error(error);
  }
}

async function messageDelete(messageId) {
  try {
    db.collection("KokoKengaku")
      .doc(talkId)
      .collection("talk")
      .doc(messageId)
      .delete();
    editModal.classList.add("hidden");
    // alert(messageId);
    alert("削除しました。");
  } catch (error) {
    alert(error);
    console.error(error);
  }
}

let profileModal;
let profileModalClose;
let profileAvatarHolder;
let profileName;
let profileNameInput; // 追加：編集用の名前入力欄
let profileText;
let profileTextEdit;  // 追加：編集用の自己紹介テキストエリア
// --- 追加：プロフィールの編集用変数 ---
let profileEditButton;
let isProfileEditing = false; // 編集モード中かどうかのフラグ
let currentProfileUserId = ""; // 現在開いているプロフィールのユーザーID

document.addEventListener("DOMContentLoaded", () => {
  // 追加要素の取得
  profileModal = document.getElementById("profile-modal");
  profileModalClose = document.getElementById("profile-modal-close");
  profileAvatarHolder = document.getElementById("profile-avatar-holder");
  profileName = document.getElementById("profile-name");
  profileNameInput = document.getElementById("profile-name-input"); // 既存DOMからあらかじめ取得
  profileText = document.getElementById("profile-text");
  profileTextEdit = document.getElementById('profile-text-edit');
  profileEditButton = document.getElementById("profile-edit-button");

  // 閉じるボタンのイベント
  profileModalClose.addEventListener("click", () => {
    profileModal.classList.add("hidden");
    resetProfileEditMode(); // モーダルを閉じるときに編集状態をリセット
  });

  // 編集・保存ボタンのクリックイベント
  profileEditButton.addEventListener("click", handleProfileEditOrSave);
});

// 編集モードをリセットする関数
function resetProfileEditMode() {
  isProfileEditing = false;
  if (profileEditButton) {
    profileEditButton.textContent = "プロフィールを編集";
    profileEditButton.disabled = false;
  }
  // 表示状態をノーマルに戻し、編集用を隠す
  if (profileName) profileName.classList.remove("hidden");
  if (profileNameInput) profileNameInput.classList.add("hidden");
  if (profileText) profileText.classList.remove("hidden");
  if (profileTextEdit) profileTextEdit.classList.add("hidden");
}

// 編集ボタン・保存ボタンが押された時の処理
async function handleProfileEditOrSave() {
  if (!isProfileEditing) {
    // 【編集モードに入る処理】
    isProfileEditing = true;
    profileEditButton.textContent = "プロフィールを保存";

    // 現在表示されているテキストを取得
    let currentName = profileName.textContent;
    let currentText = profileText.textContent;

    if (currentText === "ステータスメッセージはありません。" || currentText === "取得中...") {
      currentText = "";
    }
    if (currentName === "取得中..." || currentName === "不明なユーザー") {
      currentName = "";
    }

    profileName.classList.add("hidden");
    profileNameInput.classList.remove("hidden");
    profileNameInput.value = currentName;

    profileText.classList.add("hidden");
    profileTextEdit.classList.remove("hidden");
    profileTextEdit.value = currentText;

  } else {
    // 【保存処理】
    const newName = profileNameInput.value.trim();
    const newProfileText = profileTextEdit.value.trim();

    if (!newName) {
      alert("ユーザーネームを入力してください。");
      return;
    }

    profileEditButton.disabled = true;
    profileEditButton.textContent = "保存中...";

    try {
      // Firestoreの users_random コレクションを更新
      await db.collection("users_random").doc(currentProfileUserId).set(
        {
          name: newName,
          profileText: newProfileText
        },
        { merge: true }
      );

      // キャッシュ情報の更新
      userCache[currentProfileUserId] = newName;

      // 各UIテキストのリアルタイム更新
      drawerUsername.textContent = newName;
      
      // 通常時のテキスト要素へ反映させて復元
      profileName.textContent = newName;
      profileText.textContent = newProfileText || "ステータスメッセージはありません。";

      // アバターの頭文字も新しい名前に合わせて更新
      profileAvatarHolder.innerHTML = "";
      profileAvatarHolder.appendChild(createAvatar(newName, "large"));

      const userSnapshot = await db.collection("users_random").doc(currentProfileUserId).get();
      if (userSnapshot.exists && userSnapshot.data().isAdmin) {
        profileName.classList.add("admin");
      } else {
        profileName.classList.remove("admin");
      }
      
      resetProfileEditMode();
      alert("プロフィールを保存しました。");
    } catch (error) {
      console.error("プロフィール保存エラー:", error);
      alert("プロフィールの保存に失敗しました: " + error.message);
      profileEditButton.disabled = false;
      profileEditButton.textContent = "プロフィールを保存";
    }
  }
}

// プロフィールモーダルを開いてFirebaseから最新のステメ等を取得する関数
// startEditModeがtrueの場合、ダイレクトに編集可能なテキストエリア等を開く
async function openProfileModal(userId, startEditMode = false) {
  currentProfileUserId = userId; // 現在開いているユーザーIDを保持
  resetProfileEditMode();       // 編集状態を初期化

  // DOMを初期表示に戻す
  profileName.textContent = "取得中...";
  profileText.textContent = "取得中...";
  profileName.classList.remove("admin"); // 一旦リセット

  profileAvatarHolder.innerHTML = "";
  profileAvatarHolder.appendChild(createAvatar(userCache[userId] || "", "large"));
  
  profileEditButton.classList.add("hidden");
  profileModal.classList.remove("hidden");

  try {
    const userSnapshot = await db.collection("users_random").doc(userId).get();
    if (userSnapshot.exists) {
      const userData = userSnapshot.data();
      profileName.textContent = userData.name || "名前未設定";
      
      // 管理者ならレインボーのクラスを追加
      if (userData.isAdmin) {
        profileName.classList.add("admin");
      }

      userCache[userId] = userData.name || "名前未設定";
      userAdminCache[userId] = userData.isAdmin || false;

      // 名前が確定したのでアバターの頭文字も更新
      profileAvatarHolder.innerHTML = "";
      profileAvatarHolder.appendChild(createAvatar(userData.name || "名前未設定", "large"));

      profileText.textContent = userData.profileText || "ステータスメッセージはありません。";

      // ★ 自分のプロフィールだった場合のみ、編集ボタンを表示する
      if (meIsAdmin || userId === myUserId) {
        profileEditButton.classList.remove("hidden");
        
        // ドロワーから来たなどの場合は即座に編集モードに移行する
        if (startEditMode) {
          handleProfileEditOrSave();
        }
      }
    } else {
      profileName.textContent = "不明なユーザー";
      profileText.textContent = "";
    }
  } catch (error) {
    console.error("プロフィール取得エラー:", error);
    profileName.textContent = "エラー";
    profileText.textContent = "プロフィールの取得に失敗しました。";
  }
}

// ★ 画像送信モーダル一式（キャプション付き）
let imageUploadModal;
let openImageModalBtn;
let imageModalClose;
let modalImageInput;
let selectImageBtn;
let imagePreviewContainer;
let imagePreview;
let imageMessageInput;
let submitImageBtn;
let selectedImageFile = null;

document.addEventListener("DOMContentLoaded", () => {
  imageUploadModal = document.getElementById("image-upload-modal");
  openImageModalBtn = document.getElementById("open-image-modal-button");
  imageModalClose = document.getElementById("image-modal-close");
  modalImageInput = document.getElementById("modal-image-input");
  selectImageBtn = document.getElementById("select-image-button");
  imagePreviewContainer = document.getElementById("image-preview-container");
  imagePreview = document.getElementById("image-preview");
  imageMessageInput = document.getElementById("image-message-input");
  submitImageBtn = document.getElementById("submit-image-button");

  // 1. モーダルを開く
  openImageModalBtn.addEventListener("click", () => {
    // 状態を初期化
    selectedImageFile = null;
    modalImageInput.value = "";
    imagePreview.src = "";
    imagePreviewContainer.classList.add("hidden");
    submitImageBtn.disabled = true;
    submitImageBtn.textContent = "画像を送信";
    imageModalClose.classList.remove("hidden");
    selectImageBtn.disabled = false;
    imageMessageInput.disabled = false;
    imageUploadModal.classList.remove("hidden");
  });

  // 2. モーダルを閉じる（キャンセル）
  imageModalClose.addEventListener("click", () => {
    imageUploadModal.classList.add("hidden");
  });

  // 3. 「画像を選択する」ボタンが押されたら隠しinputを発火
  selectImageBtn.addEventListener("click", () => {
    modalImageInput.click();
  });

  // 4. ファイルが選択されたらプレビューを表示
  modalImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedImageFile = file;

    // FileReaderで読み込んでプレビュー表示
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreviewContainer.classList.remove("hidden");
      submitImageBtn.disabled = false; // 送信ボタンを活性化
    };
    reader.readAsDataURL(file);
  });

  // 5. 画像を送信する（アップロード & Firestore書き込み）
  submitImageBtn.addEventListener("click", async () => {
    if (!selectedImageFile) return;

    // UIを「アップロード中」に変更して入力をロック
    submitImageBtn.disabled = true;
    imageModalClose.classList.add("hidden"); // 閉じるボタンを無効化
    selectImageBtn.disabled = true;
    submitImageBtn.textContent = "画像をアップロード中...";
    imageMessageInput.disabled = true;

    try {
      // a. Firestoreから管理者のImgBB APIキーを安全に取得
      const keyDoc = await db.collection("system_keys").doc("imgbb").get();
      if (!keyDoc.exists) {
        throw new Error("APIキーの設定が見つかりません。セキュリティルールかドキュメントを確認してください。");
      }
      const imgbbApiKey = keyDoc.data().apiKey;

      // b. ImgBBにFormDataを使ってアップロード
      const formData = new FormData();
      formData.append("image", selectedImageFile);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error("ImgBBのアップロード処理に失敗しました。");
      }

      const imageUrl = result.data.url;

      // c. 現在のトークルーム（talkId）のtalkに画像メッセージを追加（任意のキャプション付き）
      await db.collection("KokoKengaku").doc(talkId).collection("talk").add({
        userId: myUserId,
        message: imageMessageInput.value,
        imageUrl: imageUrl,
        readBy: [],
        time: firebase.firestore.FieldValue.serverTimestamp()
      });

      // ルーム一覧側の未読カウント・並び順のためにlastUpdatedAtも更新
      await db.collection("KokoKengaku").doc(talkId).update({
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log("画像送信が完了しました！");

      // d. 成功したら自動的にモーダルを閉じる
      imageUploadModal.classList.add("hidden");
      imageMessageInput.value = "";
    } catch (error) {
      console.error("画像送信中にエラーが発生しました:", error);
      alert("画像の送信に失敗しました。\n" + error.message);
      
      // エラー時はユーザーがやり直せるようにボタンのロックを解除
      submitImageBtn.disabled = false;
      submitImageBtn.textContent = "画像を送信";
      imageModalClose.classList.remove("hidden");
      selectImageBtn.disabled = false;
      imageMessageInput.disabled = false;
    }
  });
});
