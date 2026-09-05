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

// ★ Firestoreのタイムスタンプ(またはミリ秒数値)を、比較に使いやすいミリ秒数値へ揃える
function toMillisOrNull(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  return null;
}

// ★ 景品(名前が虹色に光る演出)の持続時間。「問題投稿」アプリ側の仕様に合わせて10分間
const PRIZE_DURATION_MS = 10 * 60 * 1000;

// ★ 景品が、付与されてからまだ持続時間内（＝現在も有効）かどうか
function hasActivePrize(cached) {
  const grantedAt = cached && cached.prizeGrantedAt;
  return typeof grantedAt === "number" && grantedAt + PRIZE_DURATION_MS > Date.now();
}

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
  
  accountSettingsButton.addEventListener('click', openDrawer);
  drawerCloseButton.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
  drawerLogoutButton.addEventListener('click', handleLogout);

  // ドロワー内の「プロフィールを編集」ボタン
  drawerEditProfileButton.addEventListener('click', () => {
    closeDrawer();
    openProfileModal(myUserId, true); // 自分のプロフィールを編集モードONで開く
  });
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
        if (meIsAdmin) {
          drawerUsername.classList.add("admin");
        } else if (hasActivePrize({ prizeGrantedAt: toMillisOrNull(userData.prizeGrantedAt) })) {
          drawerUsername.classList.add("prize");
        }
        myUid = userData.uid;
        loadingOverlay.classList.add("hidden");

        // ★「新しいトークを作成」ボタンは管理者にだけ見せる
        const openCreateTalkModalButton = document.getElementById("open-create-talk-modal-button");
        if (openCreateTalkModalButton) {
          openCreateTalkModalButton.classList.toggle("hidden", !meIsAdmin);
        }

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

let profileModal;
let profileModalClose;
let profileAvatarHolder;
let profileName;
let profileNameInput;
let profileText;
let profileTextEdit;
let profileEditButton;
let isProfileEditing = false;
let currentProfileUserId = "";

document.addEventListener("DOMContentLoaded", () => {
  profileModal = document.getElementById("profile-modal");
  profileModalClose = document.getElementById("profile-modal-close");
  profileAvatarHolder = document.getElementById("profile-avatar-holder");
  profileName = document.getElementById("profile-name");
  profileNameInput = document.getElementById("profile-name-input");
  profileText = document.getElementById("profile-text");
  profileTextEdit = document.getElementById("profile-text-edit");
  profileEditButton = document.getElementById("profile-edit-button");

  profileModalClose.addEventListener("click", () => {
    profileModal.classList.add("hidden");
    resetProfileEditMode();
  });

  profileEditButton.addEventListener("click", handleProfileEditOrSave);
});

// 編集モードをリセットする関数
function resetProfileEditMode() {
  isProfileEditing = false;
  if (profileEditButton) {
    profileEditButton.textContent = "プロフィールを編集";
    profileEditButton.disabled = false;
  }
  if (profileName) profileName.classList.remove("hidden");
  if (profileNameInput) profileNameInput.classList.add("hidden");
  if (profileText) profileText.classList.remove("hidden");
  if (profileTextEdit) profileTextEdit.classList.add("hidden");
}

// 編集ボタン・保存ボタンが押された時の処理
async function handleProfileEditOrSave() {
  if (!isProfileEditing) {
    isProfileEditing = true;
    profileEditButton.textContent = "プロフィールを保存";

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
    const newName = profileNameInput.value.trim();
    const newProfileText = profileTextEdit.value.trim();

    if (!newName) {
      alert("ユーザーネームを入力してください。");
      return;
    }

    profileEditButton.disabled = true;
    profileEditButton.textContent = "保存中...";

    try {
      await db.collection("users_random").doc(currentProfileUserId).set(
        {
          name: newName,
          profileText: newProfileText
        },
        { merge: true }
      );

      drawerUsername.textContent = newName;

      profileName.textContent = newName;
      profileText.textContent = newProfileText || "ステータスメッセージはありません。";

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
  currentProfileUserId = userId;
  resetProfileEditMode();

  profileName.textContent = "取得中...";
  profileText.textContent = "取得中...";
  profileName.classList.remove("admin");

  profileAvatarHolder.innerHTML = "";
  profileAvatarHolder.appendChild(createAvatar(drawerUsername ? drawerUsername.textContent : "", "large"));

  profileEditButton.classList.add("hidden");
  profileModal.classList.remove("hidden");

  try {
    const userSnapshot = await db.collection("users_random").doc(userId).get();
    if (userSnapshot.exists) {
      const userData = userSnapshot.data();
      profileName.textContent = userData.name || "名前未設定";

      if (userData.isAdmin) {
        profileName.classList.add("admin");
      }

      profileAvatarHolder.innerHTML = "";
      profileAvatarHolder.appendChild(createAvatar(userData.name || "名前未設定", "large"));

      profileText.textContent = userData.profileText || "ステータスメッセージはありません。";

      // ★ 自分のプロフィールだった場合のみ、編集ボタンを表示する
      if (meIsAdmin || userId === myUserId) {
        profileEditButton.classList.remove("hidden");

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




// リアルタイム更新の監視を解除するための関数を保持する変数
let talkListenerUnsubscribe = null;

// ★ 更新日時を比較しやすいミリ秒数値に変換する（未設定のルームは一番古い扱いにする）
function getTalkButtonUpdatedAtMillis(talkButton) {
  const ts = talkButton.dataUpdatedAt;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
}

// ★ 更新日時（ミリ秒）から「今日」「昨日」などのグループ名を決める
const TALK_GROUP_ORDER = ["今日", "昨日", "1週間前", "1ヶ月前", "それ以前"];
function getDateGroupLabel(millis) {
  if (!millis) return "それ以前";

  const now = new Date();
  const target = new Date(millis);

  // ★ 時刻を無視して「日」単位の差で判定する
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const daysAgo = Math.round((startOfToday - startOfTarget) / (1000 * 60 * 60 * 24));

  if (daysAgo <= 0) return "今日";
  if (daysAgo === 1) return "昨日";
  if (daysAgo <= 6) return "1週間前";
  if (daysAgo <= 29) return "1ヶ月前";
  return "それ以前";
}

// ★ トーク一覧を「最終更新日時が新しいもの→古いもの」の順に並べ替えつつ、
//   「今日」「昨日」「1週間前」...のグループ見出しを挿入し直す
//   （既存のボタン要素を再アペンドするだけなので、イベントや未読表示はそのまま引き継がれる）
function regroupTalkButtons(talkButtonArea) {
  const buttons = Array.from(talkButtonArea.querySelectorAll(".talk-button"));

  // ★ グループの並び順を優先し、グループ内は更新日時が新しい順にする
  buttons.sort((a, b) => {
    const groupIndexA = TALK_GROUP_ORDER.indexOf(getDateGroupLabel(getTalkButtonUpdatedAtMillis(a)));
    const groupIndexB = TALK_GROUP_ORDER.indexOf(getDateGroupLabel(getTalkButtonUpdatedAtMillis(b)));
    if (groupIndexA !== groupIndexB) return groupIndexA - groupIndexB;
    return getTalkButtonUpdatedAtMillis(b) - getTalkButtonUpdatedAtMillis(a);
  });

  // ★ 見出しはいったん全部外して、必要な分だけ作り直す（見出し自体には状態を持たせていないので安全）
  talkButtonArea.querySelectorAll(".talk-group-header").forEach((header) => header.remove());

  let currentGroupLabel = null;
  buttons.forEach((button) => {
    const groupLabel = getDateGroupLabel(getTalkButtonUpdatedAtMillis(button));
    if (groupLabel !== currentGroupLabel) {
      const header = document.createElement("p");
      header.classList.add("talk-group-header");
      header.textContent = groupLabel;
      talkButtonArea.appendChild(header);
      currentGroupLabel = groupLabel;
    }
    talkButtonArea.appendChild(button);
  });
}

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

            // ★ 追加した直後に、グループ見出しつきで並び替える
            regroupTalkButtons(talkButtonArea);

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

              // ★ 更新日時を最新化して、グループ・並び順に反映させる
              talkButton.dataUpdatedAt = roomData.lastUpdatedAt;
              regroupTalkButtons(talkButtonArea);

              // ★ ここがポイント：未読数だけをピンポイントで数え直して更新する
              updateSingleRoomUnread(roomId, lastCheckedMap[roomId]);
            }
          }

          // 3. ルーム自体が削除された場合
          if (change.type === "removed") {
            const talkButton = document.getElementById(`room-${roomId}`);
            if (talkButton) talkButton.remove();
            // ★ 削除後、空になったグループの見出しが残らないよう整理し直す
            regroupTalkButtons(talkButtonArea);
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

// ================================
// ★ 新しいトークの作成（管理者のみ）
// ================================

let openCreateTalkModalButton;
let createTalkModal;
let createTalkModalClose;
let createTalkTitleInput;
let createTalkMemberSearch;
let createTalkMemberLoading;
let createTalkMemberList;
let createTalkSubmitButton;

let allUsersCache = null; // ★ メンバー選択用の全ユーザー一覧（一度取得したら使い回す）

document.addEventListener("DOMContentLoaded", () => {
  openCreateTalkModalButton = document.getElementById("open-create-talk-modal-button");
  createTalkModal = document.getElementById("create-talk-modal");
  createTalkModalClose = document.getElementById("create-talk-modal-close");
  createTalkTitleInput = document.getElementById("create-talk-title-input");
  createTalkMemberSearch = document.getElementById("create-talk-member-search");
  createTalkMemberLoading = document.getElementById("create-talk-member-loading");
  createTalkMemberList = document.getElementById("create-talk-member-list");
  createTalkSubmitButton = document.getElementById("create-talk-submit-button");

  openCreateTalkModalButton.addEventListener("click", openCreateTalkModal);

  createTalkModalClose.addEventListener("click", () => {
    createTalkModal.classList.add("hidden");
  });

  createTalkTitleInput.addEventListener("input", updateCreateTalkSubmitState);

  createTalkMemberSearch.addEventListener("input", () => {
    renderCreateTalkMemberList(createTalkMemberSearch.value.trim());
  });

  createTalkSubmitButton.addEventListener("click", handleCreateTalk);
});

// ★「＋ 新しいトークを作成」ボタンから呼ばれる：モーダルを開いてユーザー一覧を読み込む
async function openCreateTalkModal() {
  createTalkTitleInput.value = "";
  createTalkMemberSearch.value = "";
  createTalkModal.classList.remove("hidden");
  updateCreateTalkSubmitState();

  if (allUsersCache) {
    renderCreateTalkMemberList("");
    return;
  }

  createTalkMemberLoading.classList.remove("hidden");
  createTalkMemberList.innerHTML = "";

  try {
    const usersSnapshot = await db.collection("users_random").get();
    allUsersCache = usersSnapshot.docs
      .map((doc) => ({ userId: doc.id, name: (doc.data() || {}).name || doc.id }))
      .filter((u) => u.userId !== myUserId) // ★ 自分は自動的にメンバーへ入るので選択肢からは除く
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    createTalkMemberLoading.classList.add("hidden");
    renderCreateTalkMemberList("");
  } catch (error) {
    createTalkMemberLoading.classList.add("hidden");
    console.error("ユーザー一覧の取得エラー:", error);
    alert("ユーザー一覧の取得に失敗しました。\n" + error.message);
  }
}

// ★ 検索テキストで絞り込みつつ、チェックボックス付きのユーザー一覧を描画する
function renderCreateTalkMemberList(filterText) {
  if (!allUsersCache) return;

  // ★ 再描画前に、これまでのチェック状態を保持しておく（検索しても選択が消えないように）
  const previouslyChecked = new Set(
    Array.from(createTalkMemberList.querySelectorAll("input[type=checkbox]:checked")).map((cb) => cb.value)
  );

  createTalkMemberList.innerHTML = "";

  const lowerFilter = filterText.toLowerCase();
  const filteredUsers = allUsersCache.filter((u) => u.name.toLowerCase().includes(lowerFilter));

  if (filteredUsers.length === 0) {
    const emptyText = document.createElement("p");
    emptyText.textContent = "該当するユーザーがいません。";
    createTalkMemberList.appendChild(emptyText);
    return;
  }

  filteredUsers.forEach((u) => {
    const label = document.createElement("label");
    label.classList.add("create-talk-member-item");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = u.userId;
    checkbox.checked = previouslyChecked.has(u.userId);

    label.appendChild(checkbox);
    label.appendChild(createAvatar(u.name, "small"));

    const nameSpan = document.createElement("span");
    nameSpan.textContent = u.name;
    label.appendChild(nameSpan);

    createTalkMemberList.appendChild(label);
  });
}

// ★ タイトルが空でなければ作成ボタンを有効化する
function updateCreateTalkSubmitState() {
  const hasTitle = createTalkTitleInput && createTalkTitleInput.value.trim() !== "";
  createTalkSubmitButton.disabled = !hasTitle;
}

// ★ 実際にKokoKengakuへ新しいルームを作成する
async function handleCreateTalk() {
  const title = createTalkTitleInput.value.trim();
  if (!title) return;

  const selectedMemberIds = Array.from(
    createTalkMemberList.querySelectorAll("input[type=checkbox]:checked")
  ).map((cb) => cb.value);

  // ★ 自分（作成者）は必ずメンバーに含める
  const members = Array.from(new Set([...selectedMemberIds, myUserId]));

  createTalkSubmitButton.disabled = true;
  createTalkSubmitButton.textContent = "作成中...";

  try {
    await db.collection("KokoKengaku").add({
      title: title,
      members: members,
      lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    createTalkModal.classList.add("hidden");
    createTalkTitleInput.value = "";
    createTalkMemberSearch.value = "";
  } catch (error) {
    console.error("トーク作成エラー:", error);
    alert("トークの作成に失敗しました。\n" + error.message);
  } finally {
    createTalkSubmitButton.textContent = "作成する";
    updateCreateTalkSubmitState();
  }
}
