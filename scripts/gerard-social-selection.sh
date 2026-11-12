set -euo pipefail
mkdir -p garden
# Rank again, excluding harvests whose exact copy is confirmed published.
# Feed prior observations into the autonomous selection cycle.
if [ -f garden/gerard-learning.json ]; then
  jq -c '.guidance // {}' garden/gerard-learning.json > /tmp/gerard-prior-guidance.json
  echo "Gerard prior learning:"
  cat /tmp/gerard-prior-guidance.json
fi
# Prior learning influences the next experiment, without blocking repeats.
if [ -f garden/gerard-learning.json ]; then
  jq -r '.guidance.nextExperiment // "Explore a new angle."' garden/gerard-learning.json > /tmp/gerard-next-experiment.txt
fi
# Editorial repetitions are learning opportunities. Provider-side
# reservation fingerprints still prevent accidental transport retries.
EXCLUDED_IDS=""
EXCLUDED_SEED_IDS=""
# Temporarily explore alternatives to heavily repeated subjects.
# Evidence is bounded to the last twelve selections; never a permanent ban.
if [ -f garden/gerard-decision-history.json ]; then
  EXCLUDED_SEED_IDS="$(jq -r '
    [.[-12:][]? | .seedId // empty | select(type == "string" and length > 0)]
    | group_by(.) | map(select(length >= 3) | .[0]) | join(",")
  ' garden/gerard-decision-history.json)"
  if [ -n "$EXCLUDED_SEED_IDS" ] && [ -f garden/harvests.json ]; then
    EXCLUDED_IDS="$(jq -r --arg seeds "$EXCLUDED_SEED_IDS" '
      ($seeds | split(",")) as $excluded
      | [.. | objects | select(.seedId? as $seed | $excluded | index($seed))
        | (.harvestId? // .id? // empty) | select(type == "string")]
      | unique | join(",")
    ' garden/harvests.json)"
  fi
  [ -z "$EXCLUDED_SEED_IDS" ] || echo "Gerard explores alternatives to repeated subjects."
fi
# Close the loop: last cycle's chosen experiment affects this cycle's
# Publisher request. Exclude the seed even when local harvests are stale;
# keep known harvest IDs for compatibility, never invent new IDs.
if [ -f garden/gerard-learning.json ]; then
  EXPERIMENT="$(jq -r '.guidance.chosenExperiment // ""' garden/gerard-learning.json)"
  PREVIOUS_SEED="$(jq -r '.guidance.seedId // ""' garden/gerard-learning.json)"
  if [ "$EXPERIMENT" = "explore" ] && [ -n "$PREVIOUS_SEED" ]; then
    EXCLUDED_SEED_IDS="$EXCLUDED_SEED_IDS,$PREVIOUS_SEED"
    EXPERIMENT_IDS=""
    if [ -f garden/harvests.json ]; then
      EXPERIMENT_IDS="$(jq -r --arg seed "$PREVIOUS_SEED" '[.. | objects | select(.seedId? == $seed) | (.harvestId? // .id? // empty) | select(type == "string")] | unique | join(",")' garden/harvests.json)"
    fi
    if [ -n "$EXPERIMENT_IDS" ]; then
      EXCLUDED_IDS="$(printf '%s,%s' "$EXCLUDED_IDS" "$EXPERIMENT_IDS" | sed 's/^,//;s/,$//')"
    fi
    echo "Applying previous experiment: explore beyond $PREVIOUS_SEED"
  fi
fi
# 420 Dice remains in review. Filter its known seeds before ranking.
if [ "${GERARD_TENTACLE:-}" = "delivery" ]; then
  EXCLUDED_SEED_IDS="$EXCLUDED_SEED_IDS,420-dice,420-dice-game,420-dice-video-studio"
fi
# Keep the same exclusions on the initial and alternative requests,
# without empty entries or duplicates from combined observations.
EXCLUDED_SEED_IDS="$(printf '%s' "$EXCLUDED_SEED_IDS" | jq -sRr 'split(",") | map(select(length > 0)) | unique | join(",")')"
EXCLUDED_IDS="$(printf '%s' "$EXCLUDED_IDS" | jq -sRr 'split(",") | map(select(length > 0)) | unique | join(",")')"
select_social_package() {
local prefer_metricool="$1"
# If the top candidate is a book held for Buffer, inspect alternatives
# instead of letting that single item monopolize every scheduled cycle.
# Never force books through Metricool or bypass account routing.
BRIDGE_URL="$PUBLISHER_URL/api/social/bridge/next?excludeSeedIds=$(printf '%s' "$EXCLUDED_SEED_IDS" | jq -sRr @uri)&excludeHarvestIds=$(printf '%s' "$EXCLUDED_IDS" | jq -sRr @uri)"
HTTP_STATUS="$(curl --silent --show-error --output /tmp/gerard-social-next.json --write-out '%{http_code}' --max-time 25 "$BRIDGE_URL")" || HTTP_STATUS="000"
# Walk a bounded list of existing candidates. One Buffer-only book
# must not monopolize the Metricool delivery lane.
if [ "$prefer_metricool" = "true" ] && [ "$HTTP_STATUS" = "200" ] && [ "$(jq -r '.status // ""' /tmp/gerard-social-next.json)" = "ready" ]; then
  SEARCH_EXCLUDED_IDS="$EXCLUDED_IDS"
  for ATTEMPT in 1 2 3 4 5 6 7 8; do
    CANDIDATE_ID="$(jq -r '.harvestId // ""' /tmp/gerard-social-next.json)"
    [ -n "$CANDIDATE_ID" ] || break
    ROUTE_BODY="$(jq -c '{seedId,title,text:(.copy.text // "")}' /tmp/gerard-social-next.json)"
    ROUTE_STATUS="$(curl --silent --show-error --output /tmp/gerard-candidate-route.json --write-out '%{http_code}' --max-time 20 -X POST "$PUBLISHER_URL/api/social/editorial/route" -H 'Content-Type: application/json' --data "$ROUTE_BODY")" || ROUTE_STATUS="000"
    [ "$ROUTE_STATUS" = "200" ] || break
    PROVIDER="$(jq -r '.destination.preferredProvider // ""' /tmp/gerard-candidate-route.json)"
    if [ "$PROVIDER" = "metricool" ]; then
      echo "Found Metricool-compatible existing candidate at attempt $ATTEMPT."
      break
    fi
    echo "Candidate $ATTEMPT routes to $PROVIDER; exploring another existing harvest."
    SEARCH_EXCLUDED_IDS="$(printf '%s,%s' "$SEARCH_EXCLUDED_IDS" "$CANDIDATE_ID" | sed 's/^,//;s/,$//')"
    ALT_URL="$PUBLISHER_URL/api/social/bridge/next?excludeSeedIds=$(printf '%s' "$EXCLUDED_SEED_IDS" | jq -sRr @uri)&excludeHarvestIds=$(printf '%s' "$SEARCH_EXCLUDED_IDS" | jq -sRr @uri)"
    ALT_STATUS="$(curl --silent --show-error --output /tmp/gerard-social-alternative.json --write-out '%{http_code}' --max-time 25 "$ALT_URL")" || ALT_STATUS="000"
    if [ "$ALT_STATUS" != "200" ] || [ "$(jq -r '.status // ""' /tmp/gerard-social-alternative.json)" != "ready" ]; then
      echo "No further eligible existing candidate; retain original Buffer-safe behavior."
      break
    fi
    cp /tmp/gerard-social-alternative.json /tmp/gerard-social-next.json
  done
fi
if [ "$HTTP_STATUS" = "200" ]; then
  STATUS="$(jq -r '.status // "unknown"' /tmp/gerard-social-next.json)"
  if [ "$STATUS" != "ready" ]; then
    echo "Bridge returned HTTP 200 but is not ready: $STATUS"
    cat /tmp/gerard-social-next.json
    jq -n --arg checkedAt "$(date -u +%FT%TZ)" --arg status "$STATUS" '{preparedAt:$checkedAt,status:"blocked",reason:$status,action:"do-not-schedule"}' > garden/next-social-publication.json
  else
  jq '{
    preparedAt: (now | todateiso8601),
    status,
    contract,
    harvestId,
    seedId,
    title,
    score,
    copy,
    media,
    production,
    compatibleNetworks,
    networkRules,
    metricool,
    guardrails,
    provenance
  }' /tmp/gerard-social-next.json > garden/next-social-publication.json
  # Attach advisory creative mix to new packages only; never modify previously queued posts.
  if [ -f garden/gerard-learning.json ]; then
    jq --slurpfile learning garden/gerard-learning.json '
      . + {editorialExperiment: ($learning[0].guidance.editorialExperiment // {
        status:"advisory", suggestedCategory:null, note:"No measured creative history yet"
      })}
    ' garden/next-social-publication.json > /tmp/gerard-editorial-advisory.json
    mv /tmp/gerard-editorial-advisory.json garden/next-social-publication.json
  fi
  # Observe repeats rather than block them: learn from analytics later.
  if [ -f garden/metricool-published-snapshot.json ]; then
    jq --slurpfile published garden/metricool-published-snapshot.json '
      . + {editorialLearning:{repeatedExactCopy:(.copy.text as $t | any($published[0].published[]?; .text == $t)),lesson:"Compare repeated posts against reach and engagement; try another angle next time."}}
    ' garden/next-social-publication.json > /tmp/gerard-repeat-learning.json
    mv /tmp/gerard-repeat-learning.json garden/next-social-publication.json
  fi
  # Reconcile human-verified external posts (e.g. Instagram outside Metricool).
  # This is read-only evidence: it does not attribute the post to Gerard,
  # change deployed apps, or authorize any publication.
  if [ -f garden/verified-external-publications.json ]; then
    jq --slurpfile verified garden/verified-external-publications.json '
      . as $candidate
      | ([$verified[0].entries[]? | select(.publicationConfirmed == true and .seedId == $candidate.seedId)]) as $matches
      | . + {externalPublicationEvidence: {
          previouslyPublished: ($matches | length > 0),
          confirmedNetworks: ([$matches[].network] | unique),
          accountNames: ([$matches[].account] | unique),
          publisherAttribution: "unknown",
          source: "human-verified-external-publications",
          editorialAdvice: (if ($matches | length) > 0 then "Previously promoted: use a fresh creative angle; verify against the existing post before scheduling." else "No verified external post for this seed." end)
        }}
      | if any($matches[]; (.captionExcerpt // "") != "" and ((.captionExcerpt | ascii_downcase) == (($candidate.copy.text // "") | ascii_downcase))) then
          .status = "blocked"
          | .reason = "exact-verified-external-copy"
          | .action = "do-not-schedule"
        else . end
    ' garden/next-social-publication.json > /tmp/gerard-external-evidence.json
    mv /tmp/gerard-external-evidence.json garden/next-social-publication.json
  fi
  # Route Gerard's autonomous selection by editorial topic; never publish here.
  if [ "$(jq -r '.status' garden/next-social-publication.json)" = "blocked" ]; then
    echo "Duplicate package blocked: skipping editorial route."
  else
  ROUTE_PAYLOAD="$(jq -c '{seedId, title, text: (.copy.text // "")}' garden/next-social-publication.json)"
  ROUTE_HTTP="$(curl --silent --show-error --output /tmp/gerard-editorial-route.json --write-out '%{http_code}' -X POST "$PUBLISHER_URL/api/social/editorial/route" -H 'Content-Type: application/json' --data "$ROUTE_PAYLOAD")"
  if [ "$ROUTE_HTTP" = "200" ] && jq -e '.contract == "publisher-editorial-routing-v1" and .destination.preferredProvider != null' /tmp/gerard-editorial-route.json >/dev/null 2>&1; then
    jq --slurpfile route /tmp/gerard-editorial-route.json '
      . + {editorialRoute: $route[0], delivery: {status:"not-attempted", publishingEnabled:false}}
      | if $route[0].destination.preferredProvider == "buffer" then
          del(.metricool)
          | . + {action:"hold-for-buffer-draft", transport:{provider:"buffer",account:$route[0].destination.preferredAccount,draftOnly:true}}
        elif $route[0].destination.preferredProvider == "metricool" then
          . + {transport:{provider:"metricool",account:$route[0].destination.preferredAccount,draftOnly:true}}
        else
          del(.metricool)
          | . + {action:"do-not-schedule",transport:{provider:null,draftOnly:true}}
        end
    ' garden/next-social-publication.json > /tmp/gerard-routed.json
    mv /tmp/gerard-routed.json garden/next-social-publication.json
  else
    echo "Editorial route unavailable; hold package for review."
    jq 'del(.metricool) | . + {editorialRoute:{status:"unavailable"}, delivery:{status:"not-attempted",publishingEnabled:false}, action:"do-not-schedule"}' garden/next-social-publication.json > /tmp/gerard-routed.json
    mv /tmp/gerard-routed.json garden/next-social-publication.json
  fi
  fi # End safe editorial routing for non-duplicate package.
  # Gerard hands the selected book package to Buffer. Publisher already
  # resolves verified book destinations and official artwork; do not
  # append another Amazon link or reject unrelated books by seed name.
  if [ "$(jq -r '.editorialRoute.topic // ""' garden/next-social-publication.json)" = "book" ]; then
    # Always return exactly one JSON document. A failed jq capture()
    # previously emitted zero bytes while exiting 0; this erased
    # Gerard's package and prevented both delivery and learning.
    if jq -f scripts/gerard-book-quality.jq garden/next-social-publication.json > /tmp/gerard-book-quality.json \
       && jq -e 'type == "object" and (.harvestId | type == "string") and (.editorialQuality | type == "object")' /tmp/gerard-book-quality.json >/dev/null; then
      mv /tmp/gerard-book-quality.json garden/next-social-publication.json
    else
      echo "Book quality returned no valid package; preserving candidate and blocking its delivery."
      jq '.status="blocked" | .reason="book-quality-evaluation-invalid" | .action="do-not-schedule" | .delivery={status:"not-attempted",publishingEnabled:false}' garden/next-social-publication.json > /tmp/gerard-book-quality-fallback.json
      jq -e 'type == "object" and (.harvestId | type == "string")' /tmp/gerard-book-quality-fallback.json >/dev/null
      mv /tmp/gerard-book-quality-fallback.json garden/next-social-publication.json
    fi
  fi
  # Buffer readiness check uses Gerard's own copy; no external draft or publication.
  if [ "$(jq -r '.status // ""' garden/next-social-publication.json)" = "ready" ] && [ "$(jq -r '.transport.provider // ""' garden/next-social-publication.json)" = "buffer" ]; then
    PREFLIGHT_BODY="$(jq -c '{seedId,title,text:(.copy.text // "")}' garden/next-social-publication.json)"
    PREFLIGHT_HTTP="$(curl --silent --show-error --output /tmp/gerard-buffer-preflight.json --write-out '%{http_code}' -X POST "$PUBLISHER_URL/api/social/transports/buffer/book-preflight" -H 'Content-Type: application/json' --data "$PREFLIGHT_BODY")"
    if [ "$PREFLIGHT_HTTP" = "200" ] && jq -e '.status == "ready-for-controlled-test"' /tmp/gerard-buffer-preflight.json >/dev/null 2>&1; then
      jq --slurpfile check /tmp/gerard-buffer-preflight.json '. + {bufferPreflight:$check[0],action:"hold-for-buffer-draft"}' garden/next-social-publication.json > /tmp/gerard-preflight.json
    else
      jq --arg http "$PREFLIGHT_HTTP" '. + {bufferPreflight:{status:"blocked",httpStatus:$http},action:"do-not-schedule"}' garden/next-social-publication.json > /tmp/gerard-preflight.json
    fi
    mv /tmp/gerard-preflight.json garden/next-social-publication.json
  fi
  # Prevent internal creative instructions from leaking into public copy.
  # This is a fail-closed check for future candidates, not a rewrite of existing posts.
  if [ "$(jq -r '.status // ""' garden/next-social-publication.json)" = "ready" ]; then
    if jq -e '(.copy.text // "" | ascii_downcase) as $caption | (["**", "*[", "[plan ", "[lien en bio]", "voix off", "version \"mystère\"", "photo floue d"] | any(. as $fragment | $caption | contains($fragment)))' garden/next-social-publication.json >/dev/null; then
      echo "Editorial preflight: internal brief or raw markup detected; holding candidate."
      jq '.status="blocked" | .reason="editorial-prompt-leak" | .action="do-not-schedule" | .delivery={status:"not-attempted",publishingEnabled:false}' garden/next-social-publication.json > /tmp/gerard-editorial-block.json
      mv /tmp/gerard-editorial-block.json garden/next-social-publication.json
    fi
  fi
  # A previously used image is not forbidden forever, but an identical
  # image + caption combination must not be scheduled twice.
  if [ "$(jq -r '.status // ""' garden/next-social-publication.json)" = "ready" ] && [ -f garden/gerard-decision-history.json ]; then
    if jq -e --slurpfile candidate garden/next-social-publication.json '
      ($candidate[0].copy.text // "") as $caption |
      ($candidate[0].media.url // "") as $image |
      $caption != "" and $image != "" and
      any(.[]; (.copyText // "") == $caption and (.mediaUrl // .media.url // "") == $image)
    ' garden/gerard-decision-history.json >/dev/null; then
      echo "Editorial preflight: repeated image and caption; holding candidate."
      jq '.status="blocked" | .reason="editorial-exact-repeat" | .action="do-not-schedule" | .delivery={status:"not-attempted",publishingEnabled:false}' garden/next-social-publication.json > /tmp/gerard-repeat-block.json
      mv /tmp/gerard-repeat-block.json garden/next-social-publication.json
    fi
  fi
  echo "Social package ready:"
  jq '{status,harvestId,title,score,copy,media,compatibleNetworks}' garden/next-social-publication.json
  fi
elif [ "$HTTP_STATUS" = "404" ]; then
  echo "No eligible social harvest yet; publication remains safely skipped."
  jq -n --arg checkedAt "$(date -u +%FT%TZ)" '{preparedAt:$checkedAt,status:"empty",action:"do-not-schedule"}' > garden/next-social-publication.json
else
  echo "Publisher social bridge failed with HTTP $HTTP_STATUS; publication remains safely skipped."
  cat /tmp/gerard-social-next.json || true
  jq -n --arg checkedAt "$(date -u +%FT%TZ)" --arg httpStatus "$HTTP_STATUS" --arg pinnedHarvestId "${SELECTED_HARVEST_ID:-}" --slurpfile bridge /tmp/gerard-social-next.json '{preparedAt:$checkedAt,status:"blocked",reason:"publisher-media-or-bridge-unavailable",httpStatus:$httpStatus,harvestId:(if $pinnedHarvestId != "" then $pinnedHarvestId else ($bridge[0].harvestId // null) end),title:($bridge[0].title // null),action:"do-not-schedule"}' > garden/next-social-publication.json
fi
}

select_social_package true
if [ "${GERARD_TENTACLE:-}" = "delivery" ] &&
   jq -e '.reason == "editorial-prompt-leak" and .transport.provider == "buffer"' garden/next-social-publication.json >/dev/null; then
  cp garden/next-social-publication.json /tmp/gerard-rejected-buffer-package.json
  for RETRY in 1 2 3; do
    REJECTED_ID="$(jq -r '.harvestId // empty' garden/next-social-publication.json)"
    [ -n "$REJECTED_ID" ] || break
    case ",$EXCLUDED_IDS," in *,"$REJECTED_ID",*) break ;; esac
    EXCLUDED_IDS="${EXCLUDED_IDS:+$EXCLUDED_IDS,}$REJECTED_ID"
    echo "Buffer caption rejected; selecting a different harvest (retry $RETRY)."
    select_social_package false
    if jq -e '.status == "ready" and .transport.provider == "buffer" and .action == "hold-for-buffer-draft" and .bufferPreflight.status == "ready-for-controlled-test"' garden/next-social-publication.json >/dev/null; then
      break
    fi
  done
  if ! jq -e '.status == "ready" and .transport.provider == "buffer" and .action == "hold-for-buffer-draft" and .bufferPreflight.status == "ready-for-controlled-test"' garden/next-social-publication.json >/dev/null; then
    cp /tmp/gerard-rejected-buffer-package.json garden/next-social-publication.json
  fi
fi

set -euo pipefail
mkdir -p garden
jq '{
  explainedAt: (now | todateiso8601),
  harvestId: (.harvestId // null),
  seedId: (.seedId // null),
  subject: (.title // null),
  copyText: (.copy.text // null),
  editorialScore: (.score // null),
  chosenNetwork: (.compatibleNetworks // []),
  destination: (.editorialRoute.destination // null),
  evidence: {
    source: (.provenance.source // null),
    copyStrategy: (.copy.strategy // null),
    mediaCapability: (.production.capability // null),
    mediaFailures: (.production.mediaFailures // [])
  },
  decision: (.action // .delivery.status // .status),
  reasoning: (if .status != "ready" then
    "Aucun contenu prêt : décision suspendue."
  elif .editorialRoute.destination.preferredProvider == "metricool" then
    "Récolte éligible sélectionnée par le classement du Publisher ; routage jeux vers Metricool. Ce score ne prouve pas une préférence du public."
  elif .editorialRoute.destination.preferredProvider == "buffer" then
    "Récolte classée par Publisher ; routage livre vers Buffer. Publication non autorisée ici."
  else
    "Décision éditoriale non vérifiée ; publication suspendue."
  end),
  limits: ["Les autres candidats et leurs scores ne sont pas fournis par ce sélecteur.", "Aucune comparaison des statistiques Metricool n’est établie ici.", "Une répétition de texte déjà publié n’est pas automatiquement exclue."]
}' garden/next-social-publication.json > garden/gerard-decision-explanation.json
# Compare this selection with earlier recorded choices. This is
# operational history, not an invented Metricool performance score.
if [ -f garden/gerard-decision-history.json ]; then
  cp garden/gerard-decision-history.json /tmp/gerard-decision-history-before.json
else
  echo '[]' > /tmp/gerard-decision-history-before.json
fi
# Compare prior decisions and the verified Metricool publication snapshot.
# A published exact-copy match is evidence of duplication, not a reason
# to invent audience feedback or block unrelated content.
if [ -f garden/metricool-published-snapshot.json ]; then
  cp garden/metricool-published-snapshot.json /tmp/gerard-metricool-snapshot.json
else
  echo '{"published":[]}' > /tmp/gerard-metricool-snapshot.json
fi
jq --slurpfile history /tmp/gerard-decision-history-before.json --slurpfile published /tmp/gerard-metricool-snapshot.json '
  . as $current
  | .previousSelectionsOfSameSeed = ([$history[0][] | select(.seedId == $current.seedId)] | length)
  | .previousSelectionsOfSameCopy = ([$history[0][] | select(.copyText == $current.copyText and .copyText != null)] | length)
  | .repeatedSelection = (.previousSelectionsOfSameSeed > 0)
  | .publishedExactCopy = ([$published[0].published[] | select(.text == $current.copyText and .text != null)] | length > 0)
  | .publishedEvidence = ([$published[0].published[] | select(.text == $current.copyText and .text != null) | {id,publicationDate,networks}])
  | .historyEvidence = "Decision history and manually verified Metricool snapshot; no audience-performance inference."
  | .warning = (if .publishedExactCopy then "Exact text already published in verified Metricool history; choose a fresh angle before publishing." else null end)
' garden/gerard-decision-explanation.json > /tmp/gerard-explanation-final.json
mv /tmp/gerard-explanation-final.json garden/gerard-decision-explanation.json
# Public analytics are not necessarily available immediately. Preserve
# explicit missing-data status rather than interpreting [] as zero.
if [ -f garden/metricool-analytics-snapshot.json ]; then
  jq --slurpfile analytics garden/metricool-analytics-snapshot.json '
    . + {
      audienceFeedback: {
        status: ($analytics[0].status // "unavailable"),
        checkedAt: ($analytics[0].checkedAt // null),
        matchedMetrics: (.copyText as $copy | [$analytics[0].posts[]? | select(.text == $copy)] | length),
        note: ($analytics[0].note // "No verified per-post engagement evidence")
      }
    }
  ' garden/gerard-decision-explanation.json > /tmp/gerard-with-feedback.json
else
  jq '. + {audienceFeedback:{status:"not-collected",matchedMetrics:0,note:"No Metricool analytics snapshot available; do not infer performance."}}' garden/gerard-decision-explanation.json > /tmp/gerard-with-feedback.json
fi
mv /tmp/gerard-with-feedback.json garden/gerard-decision-explanation.json
# A missing Metricool response is not a zero score. Expose a
# concrete next action and keep performance-based ranking disabled.
jq '
  . + {
    nextAction: (
      if .publishedExactCopy then
        "Regenerate a different angle before any scheduling."
      elif .audienceFeedback.status != "available" then
        "Keep editorial ranking; retry analytics collection later."
      else
        "Compare verified engagement with other posts before adjusting ranking."
      end
    ),
    performanceRankingEnabled: false
  }
' garden/gerard-decision-explanation.json > /tmp/gerard-action.json
mv /tmp/gerard-action.json garden/gerard-decision-explanation.json
# Explicit epistemic reasoning: separate evidence, hypotheses, unknowns,
# and the next falsifiable experiment. Publisher advice is a capability
# diagnostic, never proof of audience engagement.
if [ -f garden/gerard-publisher-advice.json ]; then
  cp garden/gerard-publisher-advice.json /tmp/gerard-publisher-reasoning.json
else
  echo '{"status":"not-yet-consulted"}' > /tmp/gerard-publisher-reasoning.json
fi
jq --slurpfile publisher /tmp/gerard-publisher-reasoning.json '
  . as $d
  | .reasoningModel = {
      version:"evidence-hypothesis-experiment-v1",
      known: ([
        (if $d.seedId != null then "Publisher selected seed: " + $d.seedId else empty end),
        (if $d.publishedExactCopy then "The same copy appears in verified publication history." else empty end),
        (if $d.repeatedSelection then "This seed was previously selected." else empty end)
      ]),
      hypothesis: (if $d.repeatedSelection then "A different subject or angle may broaden editorial coverage." else "This subject is worth an initial experiment." end),
      unknown: (if ($d.audienceFeedback.matchedMetrics // 0) == 0 then ["Audience response is not yet measured for this copy."] else [] end),
      publisherSignal: {status:($publisher[0].status // $publisher[0].response.status // "received"),capability:($publisher[0].capability // "analytics.read")},
      experiment: (if $d.repeatedSelection then "Test a different angle or subject on the next cycle; compare only verified metrics." else "Publish when transport permits, then collect real outcome evidence." end),
      confidence: (if ($d.audienceFeedback.matchedMetrics // 0) > 0 then "measured" else "tentative" end)
    }
  | .nextAction = .reasoningModel.experiment
' garden/gerard-decision-explanation.json > /tmp/gerard-reasoning.json
mv /tmp/gerard-reasoning.json garden/gerard-decision-explanation.json
# Deliberation: generate alternatives, select a testable experiment,
# and retain the rationale. Publisher remains an adviser, not a judge.
jq --slurpfile history /tmp/gerard-decision-history-before.json '
  . as $d
  | ([ $history[0][]? | .seedId // empty ] | unique) as $explored
  | .deliberation = {
      version:"editorial-experiments-v1",
      alternatives:[
        {id:"explore",hypothesis:"Another subject may improve editorial diversity.",test:"Ask Publisher for a different eligible seed next cycle.",priority:(if $d.previousSelectionsOfSameSeed >= 2 then 3 else 1 end)},
        {id:"new-angle",hypothesis:"A new creative angle may perform differently.",test:"Try new copy or media while retaining the subject.",priority:(if $d.previousSelectionsOfSameCopy > 0 then 3 else 2 end)},
        {id:"observe",hypothesis:"Measured results may distinguish creative approaches.",test:"Collect verified per-post analytics before claiming an improvement.",priority:(if ($d.audienceFeedback.matchedMetrics // 0) > 0 then 3 else 1 end)}
      ],
      previouslyExploredSeedCount:($explored | length),
      evidencePolicy:"No metrics means unknown, not zero performance."
    }
  | .deliberation.chosen = (.deliberation.alternatives | sort_by(-.priority, .id) | .[0])
  | .deliberation.reason = (if .deliberation.chosen.id == "explore" then "Repeated seed selections justify an exploration experiment."
     elif .deliberation.chosen.id == "new-angle" then "Try a distinct creative treatment and compare outcomes later."
     else "Verified analytics exist; assess them before drawing conclusions." end)
  | .nextAction = .deliberation.chosen.test
' garden/gerard-decision-explanation.json > /tmp/gerard-deliberation.json
mv /tmp/gerard-deliberation.json garden/gerard-decision-explanation.json
jq --slurpfile current garden/gerard-decision-explanation.json '
  ((if type == "array" then . else [] end) + [$current[0]])[-100:]
' /tmp/gerard-decision-history-before.json > garden/gerard-decision-history.json
jq '{seedId,reasoning,decision,repeatedSelection,previousSelectionsOfSameSeed,limits}' garden/gerard-decision-explanation.json
