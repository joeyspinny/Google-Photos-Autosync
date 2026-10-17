export interface FlowStep {
  number: number;
  title: string;
  detail: string;
  badge: string;
}

export const automateSteps: FlowStep[] = [
  {
    number: 1,
    title: "Install 'Automate' from Google Play (Personal Profile)",
    detail: "Install the free app 'Automate' by LlamaLab from the Play Store inside your Personal Profile. No developer mode or terminal needed.",
    badge: "Play Store • Free"
  },
  {
    number: 2,
    title: "Grant Media & Storage Permission",
    detail: "Open Automate > Settings > Privileges and grant 'Access media & photos'. On Pixel 7 Pro (Android 14/15), this grants access to MediaStore.",
    badge: "Permissions"
  },
  {
    number: 3,
    title: "Import the 'Star Photos -> Drive RAW' Flow",
    detail: "Download our pre-made .flo file (or follow the 4-block builder) and open it with Automate.",
    badge: "1-Tap Import"
  },
  {
    number: 4,
    title: "Connect Google Account (Zero GCP Required!)",
    detail: "In the Google Drive Upload block, select your personal Google account. Automate uses its official pre-approved Google API connection—no Google Cloud Console, no API keys, no review.",
    badge: "Built-in Google Auth"
  },
  {
    number: 5,
    title: "Tap 'Start' to Run Continuously",
    detail: "Tap the Start button. Automate will run in the background as a lightweight foreground service, instantly triggering whenever you star a photo.",
    badge: "Continuous Background"
  }
];

export const taskerSteps: FlowStep[] = [
  {
    number: 1,
    title: "Install Tasker from Google Play",
    detail: "Install Tasker in your Personal Profile. Make sure to exclude it from Android battery optimization so it stays running continuously.",
    badge: "Personal Profile"
  },
  {
    number: 2,
    title: "Import the MediaStore Observer Profile",
    detail: "Download our Tasker Profile XML. In Tasker, long-press 'PROFILES' > Import Profile > select 'SyncStarredPhotos.prf.xml'.",
    badge: "Import XML"
  },
  {
    number: 3,
    title: "Sign in with Google Drive",
    detail: "Under the GD Upload action, tap the Google Account icon to authenticate. Tasker handles OAuth internally without needing a custom GCP project.",
    badge: "No GCP Needed"
  }
];

export const taskerXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<TaskerData sr="" dvi="1" tv="6.3.13">
    <Profile sr="prof1" ve="2">
        <cdate>1729170000000</cdate>
        <edate>1729170000000</edate>
        <id>9991</id>
        <mid0>9992</mid0>
        <nme>Sync Starred Photos to Drive</nme>
        <Event sr="con0" ve="2">
            <code>2048</code>
            <pri>0</pri>
            <!-- ContentProvider URI for Android MediaStore Images -->
            <Str sr="arg0" ve="3">content://media/external/images/media</Str>
        </Event>
    </Profile>
    <Task sr="task1" ve="2">
        <cdate>1729170000000</cdate>
        <edate>1729170000000</edate>
        <id>9992</id>
        <nme>Upload Latest Starred Photo</nme>
        <pri>100</pri>
        <Action sr="act0" ve="7">
            <code>123</code>
            <!-- Query MediaStore for latest photo where is_favorite=1 -->
            <Str sr="arg0" ve="3">content query --uri content://media/external/images/media --projection _data:_display_name --where "is_favorite=1" --sort "date_modified DESC" | head -n 1</Str>
            <Int sr="arg1" val="0"/>
            <Int sr="arg2" val="0"/>
            <Str sr="arg3" ve="3">%query_result</Str>
            <Str sr="arg4" ve="3"/>
            <Str sr="arg5" ve="3"/>
        </Action>
        <Action sr="act1" ve="7">
            <code>547</code>
            <!-- Extract file path -->
            <Str sr="arg0" ve="3">%file_path</Str>
            <Str sr="arg1" ve="3">%query_result</Str>
            <Int sr="arg2" val="0"/>
            <Int sr="arg3" val="0"/>
            <Int sr="arg4" val="0"/>
            <Int sr="arg5" val="3"/>
        </Action>
        <Action sr="act2" ve="7">
            <!-- Tasker Built-In Google Drive Upload Action (Uses Tasker pre-approved OAuth) -->
            <code>342</code>
            <Str sr="arg0" ve="3">%file_path</Str>
            <Str sr="arg1" ve="3">High-Res Favorites</Str>
            <Int sr="arg2" val="1"/>
        </Action>
        <Action sr="act3" ve="7">
            <code>523</code>
            <!-- Show confirmation notification -->
            <Str sr="arg0" ve="3">RAW Photo Synced</Str>
            <Str sr="arg1" ve="3">Uploaded %file_path to Google Drive with 100% EXIF</Str>
            <Str sr="arg2" ve="3"/>
            <Int sr="arg3" val="0"/>
            <Int sr="arg4" val="0"/>
            <Int sr="arg5" val="3"/>
        </Action>
    </Task>
</TaskerData>`;

export const automateFlowDescription = {
  name: "Star Photos -> Drive RAW Sync (Automate Flow)",
  blocks: [
    {
      id: "b1",
      title: "Flow Beginning",
      desc: "Starts the continuous background daemon on your personal profile."
    },
    {
      id: "b2",
      title: "Content Changed? (content://media/external/images/media)",
      desc: "Instant event listener waiting for any photo update or starring action."
    },
    {
      id: "b3",
      title: "Content Query (MediaStore Database)",
      desc: "Filter: is_favorite = 1. Retrieves true file path (_data) and true display name."
    },
    {
      id: "b4",
      title: "Check File Already Uploaded",
      desc: "Verifies against local cache so each photo is uploaded only once."
    },
    {
      id: "b5",
      title: "Google Drive Upload (Built-in Auth)",
      desc: "Uploads raw file stream to folder 'High-Res Favorites'. Uses Automate's pre-approved Google connection."
    },
    {
      id: "b6",
      title: "Loop Back to Listener",
      desc: "Returns to Block 2, waiting silently for your next starred photo."
    }
  ]
};
