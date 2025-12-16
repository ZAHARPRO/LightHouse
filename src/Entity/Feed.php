<?php

namespace App\Entity;

use App\Repository\FeedRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: FeedRepository::class)]
class Feed
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'feed', cascade: ['persist', 'remove'])]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $user = null;

    /**
     * @var Collection<int, FeedItem>
     */
    #[ORM\OneToMany(mappedBy: 'feed', targetEntity: FeedItem::class, orphanRemoval: true)]
    private Collection $feedItems;

    public function __construct()
    {
        $this->feedItems = new ArrayCollection();
    }



    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(User $user): static
    {
        $this->user = $user;

        return $this;
    }

    /**
     * @return Collection<int, FeedItem>
     */
    public function getFeedItems(): Collection
    {
        return $this->feedItems;
    }

    public function addFeedItem(FeedItem $feedItem): static
    {
        if (!$this->feedItems->contains($feedItem)) {
            $this->feedItems->add($feedItem);
            $feedItem->setFeed($this);
        }

        return $this;
    }

    public function removeFeedItem(FeedItem $feedItem): static
    {
        if ($this->feedItems->removeElement($feedItem)) {
            // set the owning side to null (unless already changed)
            if ($feedItem->getFeed() === $this) {
                $feedItem->setFeed(null);
            }
        }

        return $this;
    }





}
