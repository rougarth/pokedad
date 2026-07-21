<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { BellRing, Eye, Link, Plus, Send, Trash2, Unplug } from "@lucide/vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useRadarStore } from "@/stores/radar";

const radar = useRadarStore();
const route = useRoute();
const provider = ref<"TELEGRAM" | "DISCORD">("TELEGRAM");
const providerOptions = ["TELEGRAM", "DISCORD"] as const;
const saving = ref(false);
const message = ref("");
const form = reactive({ name: "", botToken: "", chatId: "", webhookUrl: "", enabled: true });
const canSave = computed(() => form.name.trim() && (provider.value === "TELEGRAM" ? form.botToken.trim() && form.chatId.trim() : form.webhookUrl.trim()));

onMounted(() => {
  Promise.all([radar.loadAlertChannels(), radar.loadDiscordStatus(), radar.loadAlertSettings()]).catch((error) => { message.value = String(error); });
  if (route.query.discord === "success") message.value = "Discord connected. The webhook is encrypted and ready for alerts.";
  if (route.query.discord === "error") message.value = `Discord connection did not complete (${String(route.query.reason ?? "unknown_error")}).`;
});

async function addChannel() {
  saving.value = true;
  message.value = "";
  try {
    if (provider.value === "TELEGRAM") {
      await radar.createAlertChannel({ provider: "TELEGRAM", name: form.name, enabled: form.enabled, botToken: form.botToken, chatId: form.chatId });
    } else {
      await radar.createAlertChannel({ provider: "DISCORD", name: form.name, enabled: form.enabled, webhookUrl: form.webhookUrl });
    }
    form.name = "";
    form.botToken = "";
    form.chatId = "";
    form.webhookUrl = "";
    message.value = "Channel saved. Its secret will not be shown again.";
  } catch (error) {
    message.value = String(error);
  } finally {
    saving.value = false;
  }
}

async function testChannel(id: string) {
  message.value = "";
  try {
    await radar.testAlert(id);
    message.value = "Test alert delivered.";
  } catch (error) {
    message.value = String(error);
  }
}

async function testDiscord() {
  message.value = "";
  try {
    await radar.testDiscordConnection();
    message.value = "Discord test alert delivered.";
  } catch (error) {
    message.value = String(error);
  }
}

async function disconnectDiscord() {
  message.value = "";
  await radar.disconnectDiscord();
  message.value = "Discord disconnected and its encrypted webhook configuration was removed.";
}

async function previewAlert() {
  message.value = "";
  try { await radar.previewAlert(); } catch (error) { message.value = String(error); }
}

async function sendPreview() {
  message.value = "";
  try { await radar.sendPreviewAlert(); message.value = "Template test alert delivered."; } catch (error) { message.value = String(error); }
}
</script>

<template>
  <div class="space-y-6">
    <section class="border-b border-radar-line bg-white p-5 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <Link class="size-5 text-radar-teal" />
            <h2 class="text-base font-semibold">Connect Discord</h2>
          </div>
          <p class="mt-1 text-sm text-slate-600">Authorize an incoming webhook through Discord's official OAuth screen and choose the destination server and channel.</p>
        </div>
        <StatusBadge :label="radar.discordOAuthStatus.connected ? 'CONNECTED' : radar.discordOAuthStatus.configured ? 'DISCONNECTED' : 'SETUP NEEDED'" :tone="radar.discordOAuthStatus.connected ? 'green' : 'gold'" />
      </div>

      <p v-if="!radar.discordOAuthStatus.configured" class="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Discord OAuth is not configured. Add DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI.</p>

      <dl v-if="radar.discordOAuthStatus.connected" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt class="text-xs font-semibold uppercase text-slate-500">Server ID</dt><dd class="mt-1 text-sm">{{ radar.discordOAuthStatus.guildId ?? 'Unavailable' }}</dd></div>
        <div><dt class="text-xs font-semibold uppercase text-slate-500">Channel ID</dt><dd class="mt-1 text-sm">{{ radar.discordOAuthStatus.channelId ?? 'Unavailable' }}</dd></div>
        <div><dt class="text-xs font-semibold uppercase text-slate-500">Webhook name</dt><dd class="mt-1 text-sm">{{ radar.discordOAuthStatus.webhookName ?? 'PokeDad Radar' }}</dd></div>
        <div><dt class="text-xs font-semibold uppercase text-slate-500">Configuration</dt><dd class="mt-1 text-sm">{{ radar.discordOAuthStatus.maskedConfig }}</dd></div>
        <div><dt class="text-xs font-semibold uppercase text-slate-500">Last test</dt><dd class="mt-1 text-sm">{{ radar.discordOAuthStatus.lastTestStatus ?? 'Never' }} · {{ radar.formatTime(radar.discordOAuthStatus.lastTestAt) }}</dd></div>
      </dl>
      <p v-if="radar.discordOAuthStatus.lastError" class="mt-3 text-sm font-medium text-radar-red">{{ radar.discordOAuthStatus.lastError }}</p>

      <div class="mt-4 flex flex-wrap gap-2">
        <button v-if="!radar.discordOAuthStatus.connected" class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!radar.discordOAuthStatus.configured" type="button" @click="radar.connectDiscord()"><Link class="size-4" /> Connect Discord</button>
        <button v-if="radar.discordOAuthStatus.connected" class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white" type="button" @click="testDiscord"><Send class="size-4" /> Send Test Alert</button>
        <button v-if="radar.discordOAuthStatus.connected" class="flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" type="button" @click="disconnectDiscord"><Unplug class="size-4" /> Disconnect</button>
      </div>
      <p class="mt-4 text-xs text-slate-500">If multiple test webhooks were created during setup, remove old ones in Discord Server Settings &gt; Integrations &gt; Webhooks and keep the latest PokeDad Radar connection.</p>
    </section>

    <section class="border-b border-radar-line bg-white p-5 shadow-soft">
      <div class="flex items-center gap-3">
        <BellRing class="size-5 text-radar-teal" />
        <div>
          <h2 class="text-base font-semibold">Private Alert Channels</h2>
          <p class="mt-1 text-sm text-slate-600">Tokens and webhooks are encrypted with AES-256-GCM and are never displayed again. No payment or store credentials are stored.</p>
        </div>
      </div>

      <div class="mt-5 flex gap-2" role="tablist" aria-label="Alert provider">
        <button v-for="option in providerOptions" :key="option" class="rounded border px-3 py-2 text-sm font-semibold" :class="provider === option ? 'border-radar-teal bg-teal-50 text-radar-teal' : 'border-radar-line'" type="button" @click="provider = option">{{ option === 'TELEGRAM' ? 'Telegram' : 'Discord' }}</button>
      </div>

      <form class="mt-4 grid min-w-0 gap-4 md:grid-cols-2" @submit.prevent="addChannel">
        <label class="block min-w-0 text-sm">
          <span class="text-xs font-semibold uppercase text-slate-500">Channel name</span>
          <input v-model="form.name" class="mt-2 w-full rounded border border-radar-line px-3 py-2" placeholder="Dad phone alerts" required />
        </label>
        <label v-if="provider === 'TELEGRAM'" class="block min-w-0 text-sm">
          <span class="text-xs font-semibold uppercase text-slate-500">Bot token</span>
          <input v-model="form.botToken" class="mt-2 w-full rounded border border-radar-line px-3 py-2" autocomplete="off" placeholder="123456789:..." required type="password" />
        </label>
        <label v-if="provider === 'TELEGRAM'" class="block min-w-0 text-sm">
          <span class="text-xs font-semibold uppercase text-slate-500">Chat ID</span>
          <input v-model="form.chatId" class="mt-2 w-full rounded border border-radar-line px-3 py-2" autocomplete="off" placeholder="Telegram chat ID" required type="password" />
        </label>
        <label v-else class="block min-w-0 text-sm md:col-span-2">
          <span class="text-xs font-semibold uppercase text-slate-500">Webhook URL</span>
          <input v-model="form.webhookUrl" class="mt-2 w-full rounded border border-radar-line px-3 py-2" autocomplete="off" placeholder="https://discord.com/api/webhooks/..." required type="password" />
        </label>
        <label class="flex items-center gap-3 text-sm">
          <input v-model="form.enabled" type="checkbox" />
          Enable after saving
        </label>
        <div class="flex items-center justify-end">
          <button class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!canSave || saving" type="submit">
            <Plus class="size-4" /> Add Channel
          </button>
        </div>
      </form>
      <p v-if="message" class="mt-4 rounded border border-radar-line bg-slate-50 px-3 py-2 text-sm text-slate-700">{{ message }}</p>
    </section>

    <section class="border-b border-radar-line bg-white p-5 shadow-soft">
      <div class="flex items-center gap-3"><Eye class="size-5 text-radar-teal" /><div><h2 class="text-base font-semibold">Alert Preview &amp; Test</h2><p class="mt-1 text-sm text-slate-600">Preview the compact mobile message or send one clearly marked test alert.</p></div></div>
      <div class="mt-5 grid gap-4 md:grid-cols-3">
        <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Alert type</span><select v-model="radar.alertPreviewType" class="mt-2 w-full rounded border border-radar-line px-3 py-2"><option value="ACCEPTED_PRICE_FOUND">Accepted price found</option><option value="MSRP_MATCH_FOUND">MSRP match found</option><option value="PRICE_DROPPED_ACCEPTED">Price dropped into range</option><option value="UNKNOWN_MSRP_MAPPING">Unknown MSRP mapping</option><option value="HUMAN_REVIEW_NEEDED">Human review needed</option><option value="SCAN_FAILED">Scan failed</option><option value="CONFIGURATION_NEEDED">Configuration needed</option><option value="TEST_ALERT">Test alert</option></select></label>
        <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Sample product</span><select v-model="radar.alertPreviewStockId" class="mt-2 w-full rounded border border-radar-line px-3 py-2"><option value="">Latest product or sample</option><option v-for="find in radar.finds" :key="find.id" :value="find.id">{{ find.productName }} · {{ find.storeName }}</option></select></label>
        <label class="block text-sm"><span class="text-xs font-semibold uppercase text-slate-500">Test channel</span><select v-model="radar.alertPreviewChannelId" class="mt-2 w-full rounded border border-radar-line px-3 py-2"><option value="">Select a channel</option><option v-for="channel in radar.alertChannels.filter((item) => item.enabled)" :key="channel.id" :value="channel.id">{{ channel.name }} · {{ channel.provider }}</option></select></label>
      </div>
      <div class="mt-4 flex flex-wrap gap-2"><button class="flex items-center gap-2 rounded border border-radar-line px-3 py-2 text-sm font-semibold" type="button" @click="previewAlert"><Eye class="size-4" /> Preview Only</button><button class="flex items-center gap-2 rounded bg-radar-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!radar.alertPreviewChannelId" type="button" @click="sendPreview"><Send class="size-4" /> Send Test</button></div>
      <pre v-if="radar.alertPreview" class="mt-4 whitespace-pre-wrap rounded border border-radar-line bg-slate-50 p-4 font-sans text-sm">{{ radar.alertPreview }}</pre>
    </section>

    <section>
      <div class="overflow-x-auto border border-radar-line bg-white shadow-soft">
        <table class="w-full min-w-[900px] text-left text-sm">
          <thead class="border-b border-radar-line bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th class="px-4 py-3">Channel</th><th class="px-4 py-3">Configuration</th><th class="px-4 py-3">Last Test</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody class="divide-y divide-radar-line">
            <tr v-for="channel in radar.alertChannels" :key="channel.id">
              <td class="px-4 py-4"><p class="font-semibold">{{ channel.name }}</p><p class="text-xs text-slate-500">{{ channel.provider }}</p></td>
              <td class="px-4 py-4"><p>{{ channel.maskedConfig }}</p><p v-if="channel.lastError" class="mt-1 max-w-md text-xs text-red-700">{{ channel.lastError }}</p></td>
              <td class="px-4 py-4">{{ radar.formatTime(channel.lastTestAt) }}</td>
              <td class="px-4 py-4"><StatusBadge :label="channel.lastTestStatus ?? (channel.enabled ? 'READY' : 'DISABLED')" :tone="radar.statusTone(channel.lastTestStatus ?? (channel.enabled ? 'READY' : 'DISABLED'))" /></td>
              <td class="px-4 py-4"><div class="flex justify-end gap-2">
                <label class="flex items-center gap-2 rounded border border-radar-line px-3 py-2 text-xs font-semibold"><input :checked="channel.enabled" type="checkbox" @change="radar.setAlertChannelEnabled(channel.id, ($event.target as HTMLInputElement).checked)" /> Enabled</label>
                <button class="rounded border border-radar-line p-2" title="Send test alert" type="button" @click="testChannel(channel.id)"><Send class="size-4" /></button>
                <button class="rounded border border-red-200 p-2 text-red-700" title="Delete channel" type="button" @click="radar.deleteAlertChannel(channel.id)"><Trash2 class="size-4" /></button>
              </div></td>
            </tr>
            <tr v-if="radar.alertChannels.length === 0"><td class="px-4 py-8 text-center text-slate-500" colspan="5">No alert channels configured.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
