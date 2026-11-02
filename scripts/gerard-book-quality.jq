(.title // "" | ascii_downcase) as $title
| (.copy.text // "" | ascii_downcase) as $text
| (.seedId // "") as $seed
| (if $seed == "gerard-et-gerard" then "https://www.amazon.fr/dp/B0H68811RL" elif $seed == "terra" then "https://www.amazon.fr/dp/B0H4CN5MSH" else null end) as $canonicalDestination
| ((($title | length) > 3 and ($text | contains($title)))
   or ($seed == "gerard-et-gerard" and ($text | contains("gérard")))
   or ($seed == "terra" and ($text | contains("terra")))
   # The verified, seed-specific book link identifies the work even with a creative hook.
   or ($canonicalDestination != null and ((.copy.text // "") | contains($canonicalDestination)))) as $matchingBook
| ((if $seed == "la-feulette-tachetee" or ($title | contains("feulette")) then ["crotte de nez magique"]
     elif $seed == "la-crotte-de-nez-magique" or ($title | contains("crotte de nez magique")) then ["feulette tachetée"]
     else [] end) | map(select(. as $other | $text | contains($other)))) as $crossWorkMentions
| .editorialQuality = {
    kind: "book",
    crossWorkMentions: $crossWorkMentions,
    officialCover: (if .media.official == true then .media.url else null end),
    verifiedDestination: ((.copy.text // "") | ([scan("https://www\\.amazon\\.fr/dp/[A-Za-z0-9]+")][0] // null)),
    status: (if ($crossWorkMentions | length) == 0 and (.media.official == true) and ((.media.url // "") | test("^https://"))
                  and $matchingBook
                  and ($text | test("https://www\\.amazon\\.fr/dp/[A-Za-z0-9]+"))
                  and ($canonicalDestination == null or ((.copy.text // "") | contains($canonicalDestination)))
             then "complete" else "incomplete" end)
  }
| if .editorialQuality.status != "complete" then
    .status = "blocked"
    | .reason = "book-editorial-metadata-incomplete"
    | .action = "do-not-schedule"
    | .delivery = {status: "not-attempted", publishingEnabled: false}
  else . end
