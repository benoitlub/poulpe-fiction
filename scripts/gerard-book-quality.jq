(.title // "" | ascii_downcase) as $title
| (.copy.text // "" | ascii_downcase) as $text
| (.seedId // "") as $seed
| (if $seed == "gerard-et-gerard" then "https://www.amazon.fr/dp/B0H68811RL" elif $seed == "terra" then "https://www.amazon.fr/dp/B0H4CN5MSH" else null end) as $canonicalDestination
| ((($title | length) > 3 and ($text | contains($title)))
   or ($seed == "gerard-et-gerard" and ($text | contains("gérard")))
   or ($seed == "terra" and ($text | contains("terra")))) as $matchingBook
| .editorialQuality = {
    kind: "book",
    officialCover: (if .media.official == true then .media.url else null end),
    verifiedDestination: ((.copy.text // "") | ([scan("https://www\\.amazon\\.fr/dp/[A-Za-z0-9]+")][0] // null)),
    status: (if (.media.official == true) and ((.media.url // "") | test("^https://"))
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
